import * as Graph from "./graph";
import * as Geom from "../../lib/geometry";
import { merge_maps } from "./diff";
import { default as validate } from "./validate";

const angle_from_assignment = function(assignment) {
	switch (assignment) {
		case "M":
		case "m":
			return -180;
		case "V":
		case "v":
			return 180;
		default:
			return 0;
	}
}

/**
 * @returns index of nearest vertex in vertices_ arrays or
 *  undefined if there are no vertices_coords
 */
export const nearest_vertex = function(graph, point) {
	if (graph.vertices_coords == null || graph.vertices_coords.length === 0) {
		return undefined;
	}
	let p = [...point];
	if (p[2] == null) { p[2] = 0; }
	return graph.vertices_coords.map(v => v
		.map((n,i) => Math.pow(n - p[i], 2))
		.reduce((a,b) => a + b,0)
	).map((n,i) => ({d:Math.sqrt(n), i:i}))
	.sort((a,b) => a.d - b.d)
	.shift()
	.i;
};

/**
 * returns index of nearest edge in edges_ arrays or
 *  undefined if there are no vertices_coords or edges_vertices
 */
export const nearest_edge = function(graph, point) {
	if (graph.vertices_coords == null || graph.vertices_coords.length === 0 ||
		graph.edges_vertices == null || graph.edges_vertices.length === 0) {
		return undefined;
	}
	// todo, z is not included in the calculation
	return graph.edges_vertices
		.map(e => e.map(ev => graph.vertices_coords[ev]))
		.map(e => Geom.Edge(e))
		.map((e,i) => ({e:e, i:i, d:e.nearestPoint(point).distanceTo(point)}))
		.sort((a,b) => a.d - b.d)
		.shift()
		.i;
};

export const face_containing_point = function(graph, point) {
	if (graph.vertices_coords == null || graph.vertices_coords.length === 0 ||
		graph.faces_vertices == null || graph.faces_vertices.length === 0) {
		return undefined;
	}
	let face = graph.faces_vertices
		.map((fv,i) => ({face:fv.map(v => graph.vertices_coords[v]),i:i}))
		.filter(f => Geom.core.intersection.point_in_poly(f.face, point))
		.shift()
	return (face == null ? undefined : face.i);
};

export const faces_containing_point = function(graph, point) {
	if (graph.vertices_coords == null || graph.vertices_coords.length === 0 ||
		graph.faces_vertices == null || graph.faces_vertices.length === 0) {
		return undefined;
	}
	return graph.faces_vertices
		.map((fv,i) => ({face:fv.map(v => graph.vertices_coords[v]),i:i}))
		.filter(f => Geom.core.intersection.point_in_polygon(f.face, point))
		.map(f => f.i);
};


export const make_faces_matrix = function(graph, root_face) {
	let faces_matrix = graph.faces_vertices.map(v => [1,0,0,1,0,0]);
	Graph.make_face_walk_tree(graph, root_face).forEach((level) =>
		level.filter((entry) => entry.parent != null).forEach((entry) => {
			let edge = entry.edge.map(v => graph.vertices_coords[v])
			let vec = [edge[1][0] - edge[0][0], edge[1][1] - edge[0][1]];
			let local = Geom.core.algebra.make_matrix2_reflection(vec, edge[0]);
			faces_matrix[entry.face] = Geom.core.algebra.multiply_matrices2(faces_matrix[entry.parent], local);
		})
	);
	return faces_matrix;
}

export const make_faces_matrix_inv = function(graph, root_face) {
	let faces_matrix = graph.faces_vertices.map(v => [1,0,0,1,0,0]);
	Graph.make_face_walk_tree(graph, root_face).forEach((level) =>
		level.filter((entry) => entry.parent != null).forEach((entry) => {
			let edge = entry.edge.map(v => graph.vertices_coords[v])
			let vec = [edge[1][0] - edge[0][0], edge[1][1] - edge[0][1]];
			let local = Geom.core.algebra.make_matrix2_reflection(vec, edge[0]);
			faces_matrix[entry.face] = Geom.core.algebra.multiply_matrices2(local, faces_matrix[entry.parent]);
		})
	);
	return faces_matrix;
}
export const split_convex_polygon = function(graph, faceIndex, linePoint, lineVector, crease_assignment = "F") {
	// survey face for any intersections which cross directly over a vertex
	let vertices_intersections = graph.faces_vertices[faceIndex]
		.map(fv => graph.vertices_coords[fv])
		.map(v => Geom.core.intersection.point_on_line(linePoint, lineVector, v) ? v : undefined)
		.map((point, i) => ({
			point: point,
			i_face: i,
			i_vertices: graph.faces_vertices[faceIndex][i]
		}))
		.filter(el => el.point !== undefined);

	// gather all edges of this face which cross the line
	let edges_intersections = graph.faces_edges[faceIndex]
		.map(ei => graph.edges_vertices[ei])
		.map(edge => edge.map(e => graph.vertices_coords[e]))
		.map(edge => Geom.core.intersection.line_edge_exclusive(linePoint, lineVector, edge[0], edge[1]))
		.map((point, i) => ({
			point: point,
			i_face: i,
			i_edges: graph.faces_edges[faceIndex][i]
		}))
		.filter(el => el.point !== undefined);

	// the only cases we care about are
	// - 2 edge intersections
	// - 2 vertices intersections
	// - 1 edge intersection and 1 vertex intersection
	// resolve each case by either gatering vertices (v-intersections) or splitting edges and making new vertices (e-intersections)
	let new_v_indices = [];
	let edge_map = Array.from(Array(graph.edges_vertices.length)).map(_=>0);
	if (edges_intersections.length === 2) {
		new_v_indices = edges_intersections.map((el,i,arr) => {
			let diff = Graph.add_vertex_on_edge(graph, el.point[0], el.point[1], el.i_edges);
			arr.slice(i+1)
				.filter(el => diff.edges.map[el.i_edges] != null)
				.forEach(el => el.i_edges += diff.edges.map[el.i_edges]);
			edge_map = merge_maps(edge_map, diff.edges.map);
			return diff.vertices.new[0].index;
		});
	} else if (edges_intersections.length === 1 && vertices_intersections.length === 1) {
		let a = vertices_intersections.map(el => el.i_vertices);
		let b = edges_intersections.map((el,i,arr) => {
			let diff = Graph.add_vertex_on_edge(graph, el.point[0], el.point[1], el.i_edges);
			arr.slice(i+1)
				.filter(el => diff.edges.map[el.i_edges] != null)
				.forEach(el => el.i_edges += diff.edges.map[el.i_edges]);
			edge_map = diff.edges.map;
			return diff.vertices.new[0].index;
		});
		new_v_indices = a.concat(b);
	} else if (vertices_intersections.length === 2) {
		new_v_indices = vertices_intersections.map(el => el.i_vertices);
	} else {
		return {};
	}
	// this results in a possible removal of edges. we now have edge_map marking this change
	// example: [0,0,0,-1,-1,-1,-1,-2,-2,-2]

	// connect an edge splitting the polygon into two, joining the two vertices
	// 1. rebuild the two faces
	//    (a) faces_vertices
	//    (b) faces_edges
	// 2. build the new edge

	// inside our face's faces_vertices, get index location of our new vertices
	// this helps us build both faces_vertices and faces_edges arrays
	let new_face_v_indices = new_v_indices
		.map(el => graph.faces_vertices[faceIndex].indexOf(el))
		.sort((a,b) => a-b);

	// construct data for our new geometry: 2 faces (faces_vertices, faces_edges)
	let new_faces = [{}, {}];
	new_faces[0].vertices = graph.faces_vertices[faceIndex]
		.slice(new_face_v_indices[1])
		.concat(graph.faces_vertices[faceIndex].slice(0, new_face_v_indices[0]+1));
	new_faces[1].vertices = graph.faces_vertices[faceIndex]
		.slice(new_face_v_indices[0], new_face_v_indices[1]+1);
	new_faces[0].edges = graph.faces_edges[faceIndex]
		.slice(new_face_v_indices[1])
		.concat(graph.faces_edges[faceIndex].slice(0, new_face_v_indices[0]))
		.concat([graph.edges_vertices.length]);
	new_faces[1].edges = graph.faces_edges[faceIndex]
		.slice(new_face_v_indices[0], new_face_v_indices[1])
		.concat([graph.edges_vertices.length]);

	// construct data for our new edge (vertices, faces, assignent, foldAngle, length)
	let new_edges = [{
		index: graph.edges_vertices.length,
		vertices: [...new_v_indices],
		assignment: crease_assignment,
		foldAngle: angle_from_assignment(crease_assignment),
		length: Geom.core.algebra.distance2(
			...(new_v_indices.map(v => graph.vertices_coords[v]))
		),
		// todo, unclear if these are ordered with respect to the vertices
		faces: [graph.faces_vertices.length, graph.faces_vertices.length+1]
	}];

	// add 1 new edge and 2 new faces to our graph
	let edges_count = graph.edges_vertices.length;
	let faces_count = graph.faces_vertices.length;
	new_faces.forEach((face,i) => Object.keys(face)
		.forEach(suffix => graph["faces_"+suffix][faces_count+i] = face[suffix])
	);
	new_edges.forEach((edge,i) => Object.keys(edge)
		.filter(suffix => suffix !== "index")
		.forEach(suffix => graph["edges_"+suffix][edges_count+i] = edge[suffix])
	);
	// update data that has been changed by edges
	new_edges.forEach((edge, i) => {
		let a = edge.vertices[0];
		let b = edge.vertices[1];
		// todo, it appears these are going in counter-clockwise order, but i don't know why
		graph.vertices_vertices[a].push(b);
		graph.vertices_vertices[b].push(a);
	});


	// rebuild edges_faces, vertices_faces
	// search inside vertices_faces for an occurence of the removed face,
	// determine which of our two new faces needs to be put in its place
	// by checking faces_vertices, by way of this map we build below:
	let v_f_map = {};
	graph.faces_vertices
		.map((face,i) => ({face: face, i:i}))
		.filter(el => el.i === faces_count || el.i === faces_count+1)
		.forEach(el => el.face.forEach(v => {
			if (v_f_map[v] == null) { v_f_map[v] = []; }
			v_f_map[v].push(el.i)
		}));
	graph.vertices_faces
		.forEach((vf,i) => {
			let indexOf = vf.indexOf(faceIndex);
			while (indexOf !== -1) {
				graph.vertices_faces[i].splice(indexOf, 1, ...(v_f_map[i]));
				indexOf = vf.indexOf(faceIndex);
			}
		})
	// the same as above, but making a map of faces_edges to rebuild edges_faces
	let e_f_map = {};
	graph.faces_edges
		.map((face,i) => ({face: face, i:i}))
		.filter(el => el.i === faces_count || el.i === faces_count+1)
		.forEach(el => el.face.forEach(e => {
			if (e_f_map[e] == null) { e_f_map[e] = []; }
			e_f_map[e].push(el.i)
		}));
	graph.edges_faces
		.forEach((ef,i) => {
			let indexOf = ef.indexOf(faceIndex);
			while (indexOf !== -1) {
				graph.edges_faces[i].splice(indexOf, 1, ...(e_f_map[i]));
				indexOf = ef.indexOf(faceIndex);
			}
		});

	// remove faces, adjust all relevant indices
	let faces_map = Graph.remove_faces(graph, [faceIndex]);

	// return a diff of the geometry
	return {
		faces: {
			map: faces_map,
			replace: [{
				old: faceIndex,
				new: new_faces
			}]
		},
		edges: {
			new: new_edges,
			map: edge_map
		}
	}
}

/** 
 * when an edge sits inside a face with its endpoints collinear to face edges,
 *  find those 2 face edges.
 * @param [[x, y], [x, y]] edge
 * @param [a, b, c, d, e] face_vertices. just 1 face. not .fold array
 * @param vertices_coords from .fold
 * @return [[a,b], [c,d]] vertices indices of the collinear face edges. 1:1 index relation to edge endpoints.
 */
var find_collinear_face_edges = function(edge, face_vertices, vertices_coords){
	let face_edge_geometry = face_vertices
		.map((v) => vertices_coords[v])
		.map((v, i, arr) => [v, arr[(i+1)%arr.length]]);
	return edge.map((endPt) => {
		// filter collinear edges to each endpoint, return first one
		// as an edge array index, which == face vertex array between i, i+1
		let i = face_edge_geometry
			.map((edgeVerts, edgeI) => ({index:edgeI, edge:edgeVerts}))
			.filter((e) => Geom.core.intersection.point_on_edge(e.edge[0], e.edge[1], endPt))
			.shift()
			.index;
		return [face_vertices[i], face_vertices[(i+1)%face_vertices.length]]
			.sort((a,b) => a-b);
	})
}


export function clip_line(fold, linePoint, lineVector){
	function len(a,b){
		return Math.sqrt(Math.pow(a[0]-b[0],2) + Math.pow(a[1]-b[1],2));
	}

	let edges = fold.edges_vertices
		.map(ev => ev.map(e => fold.vertices_coords[e]));

	return [lineVector, [-lineVector[0], -lineVector[1]]]
		.map(lv => edges
			.map(e => Geom.core.intersection.ray_edge(linePoint, lv, e[0], e[1]))
			.filter(i => i != null)
			.map(i => ({intersection:i, length:len(i, linePoint)}))
			.sort((a, b) => a.length - b.length)
			.map(el => el.intersection)
			.shift()
		).filter(p => p != null);
}


export const add_crease = function(graph, a, b, c, d) {
	// let edge = Geom.Edge([a, b, c, d]);
	let edge = Geom.Edge([a, b]);

	console.log(Geom);

	let edge_vertices = edge.endpoints
		.map(ep => graph.vertices_coords
			.map(v => Math.sqrt(Math.pow(ep[0]-v[0],2)+Math.pow(ep[1]-v[1],2)))
			.map((d,i) => d < 0.00000001 ? i : undefined)
			.filter(el => el !== undefined)
			.shift()
		).map((v,i) => {
			if (v !== undefined) { return v; }
			// else
			graph.vertices_coords.push(edge.endpoints[i]);
			return graph.vertices_coords.length - 1;
		});

	graph.edges_vertices.push(edge_vertices);
	graph.edges_assignment.push("F");
	return graph.edges_vertices.length-1;
}


