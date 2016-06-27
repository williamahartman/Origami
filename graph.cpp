// GRAPH.CPP
//
// for purposes of modeling origami crease patterns
//
// this is a graph data structure containing edges and vertices
// vertices are points in 3D space {x,y,z}
// all the geometry is made to easily incorporate into OpenGL calls

#include "graph.h"

#include <stdlib.h>
#include <stdio.h>
#include <math.h>


// Given three colinear points a, b, r, the function checks if
// point b lies on line segment 'ar'
bool onSegment(Vertex a, Vertex b, Vertex r){
    if (b.x <= max(a.x, r.x) && b.x >= min(a.x, r.x) &&
        b.y <= max(a.y, r.y) && b.y >= min(a.y, r.y))
        return true;
    return false;
}

// To find orientation of ordered triplet (a, b, r).
// The function returns following values
// 0 --> a, b and r are colinear
// 1 --> Clockwise
// 2 --> Counterclockwise
int orientation(Vertex a, Vertex b, Vertex r){
    int val = (b.y - a.y) * (r.x - b.x) - (b.x - a.x) * (r.y - b.y);
    if (val == 0) return 0;  // colinear
    return (val > 0)? 1: 2; // clock or counterclock wise
}

// The main function that returns true if line segment 'a1a2'
// and 'b1b2' intersect.
bool doIntersect(Vertex a1, Vertex a2, Vertex b1, Vertex b2){
    // Find the four orientations needed for general and
    // special cases
    int o1 = orientation(a1, a2, b1);
    int o2 = orientation(a1, a2, b2);
    int o3 = orientation(b1, b2, a1);
    int o4 = orientation(b1, b2, a2);
    
    // General case
    if (o1 != o2 && o3 != o4)
        return true;
    
    // Special Cases
    // a1, a2 and b1 are colinear and b1 lies on segment a1a2
    if (o1 == 0 && onSegment(a1, b1, a2)) return true;
    
    // a1, a2 and b1 are colinear and b2 lies on segment a1a2
    if (o2 == 0 && onSegment(a1, b2, a2)) return true;
    
    // b1, b2 and a1 are colinear and a1 lies on segment b1b2
    if (o3 == 0 && onSegment(b1, a1, b2)) return true;
    
    // b1, b2 and a2 are colinear and a2 lies on segment b1b2
    if (o4 == 0 && onSegment(b1, a2, b2)) return true;
    
    return false; // Doesn't fall in any of the above cases
}



/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////



Graph::Graph(int initial){
    switch (initial) {
        case 0:
            break;
        case 1:
            break;
        default:
            break;
    }
}

// crease start and finish, on a scale of 0 to 1
void Graph::crease(float x1, float y1, float x2, float y2){
    addVerticesWithEdge(x1, y1, x2, y2);
}

void Graph::addVerticesWithEdge(float x1, float y1, float x2, float y2){
    unsigned short v1 = v.size();
    unsigned short v2 = v.size()+1;
    Edge e1 = {v1, v2};
    addVerticesWithoutEdge(x1, y1, x2, y2);
    e.push_back(e1);
}

void Graph::addVerticesWithoutEdge(float x1, float y1, float x2, float y2){
    Vertex v1 = {x1, y1};
    Vertex v2 = {x2, y2};
    v.push_back(v1);
    v.push_back(v2);
}


bool Graph::isValid(){
    invalidEdgeCrossings();
}

bool Graph::invalidEdgeCrossings(){
    float SCALE = 100.0;
    for(int i = 0; i < e.size(); i++){
        for(int j = 0; j < e.size(); j++){
            if(i != j){
                Vertex vertex[4];
                vertex[0] = v[ e[i].v1 ];
                vertex[1] = v[ e[i].v2 ];
                vertex[2] = v[ e[j].v1 ];
                vertex[3] = v[ e[j].v2 ];
                for(int k = 0; k < 4; k++){
                    vertex[k].x *= SCALE;
                    vertex[k].y *= SCALE;
                    vertex[k].z *= SCALE;
                }
                if(doIntersect(vertex[0], vertex[1], vertex[2], vertex[3]))
                    return true;
            }
        }
    }
    return false;
}

bool Graph::edgeIsValid(unsigned int edgeIndex){
    float SCALE = 100.0;
    for(int i = 0; i < e.size(); i++){
        if(edgeIndex != i){
            Vertex vertex[4];
            vertex[0] = v[ e[edgeIndex].v1 ];
            vertex[1] = v[ e[edgeIndex].v2 ];
            vertex[2] = v[ e[i].v1 ];
            vertex[3] = v[ e[i].v2 ];
            for(int j = 0; j < 4; j++){
                vertex[j].x *= SCALE;
                vertex[j].y *= SCALE;
                vertex[j].z *= SCALE;
            }
            if(doIntersect(vertex[0], vertex[1], vertex[2], vertex[3]))
                return false;
        }
    }
    return true;
}
void Graph::log(){
    printf("\nVertices:\n");
    for(int i = 0; i < v.size(); i++)
        printf(" %d: (%f, %f, %f)\n", i, v[i].x, v[i].y, v[i].z);
    printf("\nEdges:\n");
    for(int i = 0; i < e.size(); i++)
        printf(" %d: (%d -- %d)\n", i, e[i].v1, e[i].v2);
}

vector<unsigned int> Graph::connectedVertexIndices(unsigned int vIndex){
    vector<unsigned int> indices;
    // iterate over all edges
    for(int i = 0; i < e.size(); i++){
        // if we find our index, add the vertex on the other end of the edge
        if(this->e[i].v1 == vIndex)
            indices.push_back(this->e[i].v2);
        if(this->e[i].v2 == vIndex)
            indices.push_back(this->e[i].v1);
    }
    return indices;
}

vector<unsigned int> Graph::connectingEdgeIndices(unsigned int vIndex){
    vector<unsigned int> indices;
    // iterate over all edges
    for(int i = 0; i < e.size(); i++){
        // if we find our vertex, add the edge
        if(this->e[i].v1 == vIndex || this->e[i].v2 == vIndex)
            indices.push_back(i);
    }
    return indices;
}

vector<unsigned int> Graph::connectingVertexIndicesSortedRadially(unsigned int vIndex){
    vector<unsigned int> connectedVertices = connectedVertexIndices(vIndex);
    vector<float> globalAngleValues;  // calculated from global 0deg line
    // we have to query the global angle of each segment
    // so we can locally sort each clockwise or counter clockwise
    vector<float> sortedGlobalAngleValues;
    for(int i = 0; i < connectedVertices.size(); i++){
        float angle = atan2(this->v[connectedVertices[i]].y - this->v[vIndex].y,
                            this->v[connectedVertices[i]].x - this->v[vIndex].x);
        globalAngleValues.push_back( angle );
        sortedGlobalAngleValues.push_back( angle );
    }
    sort(sortedGlobalAngleValues.begin(), sortedGlobalAngleValues.begin()+connectedVertices.size());
    // now each edge'd sprout angle is sorted from -pi to pi
    vector<unsigned int> connectedVertexIndicesSorted;
    for(int i = 0; i < connectedVertices.size(); i++)
        for(int j = 0; j < connectedVertices.size(); j++)
            if(sortedGlobalAngleValues[i] == globalAngleValues[j])
                connectedVertexIndicesSorted.push_back(connectedVertices[j]);
    return connectedVertexIndicesSorted;
}

vector<float> Graph::connectingVertexInteriorAngles(unsigned int vIndex, vector<unsigned int> connectedVertexIndicesSorted){
    vector<float> anglesBetweenVertices;
    vector<float> anglesOfVertices;
    for(int i = 0; i < connectedVertexIndicesSorted.size(); i++){
        float angle = atan2(this->v[connectedVertexIndicesSorted[i]].y - this->v[vIndex].y,
                            this->v[connectedVertexIndicesSorted[i]].x - this->v[vIndex].x);
        anglesOfVertices.push_back(angle);
    }
    for(int i = 0; i < anglesOfVertices.size(); i++){
        // when it's the wrap around value (i==3) add 2pi to the angle it's subtracted from
        float diff = anglesOfVertices[(i+1)%anglesOfVertices.size()]
        + (M_PI*2 * (i==3)) 
        - anglesOfVertices[i%anglesOfVertices.size()];
        anglesBetweenVertices.push_back( diff );
    }
    return anglesBetweenVertices;
}

void Graph::rotateEdge(int index, int indexOrigin, float angle){
    float distance = sqrt(powf( this->v[indexOrigin].y - this->v[index].y ,2)
                          +powf( this->v[indexOrigin].x - this->v[index].x ,2));
    float currentAngle = atan2(this->v[index].y, this->v[index].x);
    this->v[index].x = distance*cosf(currentAngle + angle);
    this->v[index].y = distance*sinf(currentAngle + angle);
}
