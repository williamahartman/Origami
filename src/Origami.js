'use strict';

import * as Geometry from './geometry.js'

class Fold{
	static square(meta){
		var author = ""
		if(meta != undefined){
			if(meta.author != undefined){ author = meta.author; }
		}
		return {
			"file_spec":1,
			"file_creator":"Rabbit Ear",
			"file_author":author,
			"file_classes":["singleModel"],
			"vertices_coords":[[0,0],[1,0],[1,1],[0,1]],
			"edges_vertices":[[0,1],[1,2],[2,3],[3,0]],
			"edges_assignment":["B","B","B","B"],
			"faces_vertices":[[0,1,2,3]],
			"faces_layer":[0],
			"faces_matrix":[[1, 0, 0, 1, 0, 0]],
			"faces_coloring":[0]
		};
	}
}

function makeFaceClipLines(foldFile, line){
	// use each face's matrix to transform the input line
	//   from folded coords to crease pattern coords
	var matrices = foldFile["faces_matrix"].map(function(n){ 
			return new Geometry.Matrix(n[0], n[1], n[2], n[3], n[4], n[5]);
		},this);
	return foldFile.faces_vertices.map(function(nodeArray){
		// from face vertex indices, create faces with vertex geometry
		var points = nodeArray
			.map(function(n){ return foldFile.vertices_coords[n]; },this)
			.map(function(p){ return {x:p[0], y:p[1]} })
		// convex hull algorithm turns faces into a convex polygon object
		return RabbitEar.Geometry.ConvexPolygon.convexHull(points);
	},this).map(function(poly, i){
		// clip line inside convex polygon. or undefined if no intersection
		return poly.clipLine( line.transform(matrices[i].inverse()) );
	},this).map(function(edge){
		// convert to [ [x,y], [x,y] ]. or undefined if no intersection
		if(edge != undefined){return [[edge.nodes[0].x,edge.nodes[0].y],[edge.nodes[1].x,edge.nodes[1].y]];}
		return undefined;
	},this);
}

// makeFaceClipLines = (fold, line) -> 
//     for vertex_indices in faces_vertices
//       points     = [fold.vertices_coords[i] for i in vertex_indices]
//       convexHull = ConvexHull(points)
//       clipLine   = convexHull.clipLine()
//       [[x, y], [x, y]]

export default class Origami{

	constructor(){
		this.unfolded = Fold.square();
		this.folded = Fold.square();
	}

	crease(line){

		// 1. vertices_intersections
		// [ boolean, boolean, boolean, boolean, boolean, boolean]
		var faces_clipLines = makeFaceClipLines(this.unfolded, line);
    // input is a fold format JSON and a Robby line
    // output is an faces_ array of pairs of [x, y] points, or undefined

    // 2. walk around each face with a clipped edge.
    //     check clipped edge endpoints for intersection with edges and vertices in order
    //     initialize new vertex set with old vertices
    //     make dictionary 
    //       from edges (in verted index sorted order) 
    //       to vertex indices
    //     add new vertices when necessary and translate faces_line to vertex index pairs
    //     (each clip line goes from [(x, y), (x, y)] to [v1, v2])
    var output = cleanClipSegments(this.unfold, faces_clipLine);
    var faces_clipSegmentByIndex = output.faces_clipSegmentByIndex;
    var newVertices_coords      = output.newVertices_coords;

    //     walk around each face and build split faces side1, side2 using new vertices_coords
    var faces_splitFaces = splitFaces(this.unfold, faces_clipLine, newVertices_coords);

    // 3.5. draw lines on crease pattern
    //  - using faces_lines, draw these on crease pattern
    // 
    // now user clicks on a face:
    // -------
    // we loop through faces, checking if user clicked in face. choose top most one f
    // then check which side was click by checking click intersection with faces_pieces[f]
    // NOW WE KNOW which side1 or side2 inside all of faces_pieces will be the one that moves

    var faces_splitFaces_move = markMovingFaces(
        this.unfold, 
        faces_splitFaces, 
        newVertices_coords, 
        point
    );
    // point is place where user clicked
    // unfold must have faces_layer as a permutation of the face indices

    var newUnfolded = foldMovingFaces(
        this.unfold, 
        faces_splitFaces, 
        newVertices_coords, 
        faces_splitFaces_move
    );

		// var creasePattern = new CreasePattern().importFoldFile(this.unfolded);
		// creasePattern.crease(line);
		//


	}

}

function markMovingFaces(fold, faces_splitFaces, vertices_coords, point) {
  let faces_vertices = fold.faces_vertices;
  let faces_layer    = fold.faces_layer;

  // get index of highest layer face which intersects point
  let touched_face_index = faces_splitFaces.reduce(
    (touched, splitFaces, idx) => {
      touched = Math.max(touched, splitFaces.reduce(
        (touched, vertex_indices, side) => {
          let points = vertex_indices
            .map(vi => vertices_coords[vi])
            .map(p  => {x: p[0], y: p[1]});
          let polygon = RabbitEar.Geometry.ConvexPolygon.convexHull(points);
          let p = {x: point[0], y: point[1]}
          if (polygon.contains(p) && (
              (touched === undefined) ||
              (faces_layer[touched.idx] < faces_layer[idx]))) {
            touched = {idx: idx, side: side};
          }
        }
      }, touched));
    }, undefined);
  if (touched === undefined) {
    return undefined;
  }

  // make faces_faces
  let nf = faces_vertices.length;
  let faces_faces = Array(nf).map(() => []);
  let edgeMap = {};
  faces_vertices.forEach((vertices, idx1) => {
    n = vertices.length;
    vertices.forEach((u, i, vs) => {
      v = vs[(i + 1) % n];
      if (v < u) {
        [u, v] = [v, u];
      }
      let key = `${u},${v}`;
      if (key in edgeMap) {
        idx2 = edgeMap[key];
        faces_faces[idx1].push(idx2);
        faces_faces[idx2].push(idx1);
      } else {
        edgeMap[key] = idx1;
      }
    }); 
  });

  let faces_splitFaces_move = Array(nf).map(() => Array(2).map(() => false));
  faces_splitFaces_move[touched.idx][touched.side] = true;
  
  // 

  // for (var i = 0; i < faces.length; i++) {
  //    vertices   = faces_vertices[i];
  //    layer      = faces_layer[i];
  //    splitFaces = faces_splitFaces[i];
  //    move       = faces_splitFaces_move[i];
  // }
  return faces_splitFaces_move;
}

