import { BufferAttribute, Mesh, Vector3 } from 'three';
import { cleanPolygons, getPolygonBounds, splitPolygon } from './PolygonUtils.js';
import { calculateAngleSum, resampleLine } from './GeoJSONShapeUtils.js';
import { triangulate } from './triangulate.js';
import { getCenter, offsetPoints, transformToEllipsoid } from './FlatVertexBufferUtils.js';

const _vec = new /* @__PURE__ */ Vector3();
const _min = new /* @__PURE__ */ Vector3();
const _max = new /* @__PURE__ */ Vector3();

function pointIsInPolygon( polygon, x, y ) {

	// TODO: check distnce to edges

	const [ contour, ...holes ] = polygon;
	const isInContour = calculateAngleSum( contour, x, y ) > 3.14;
	if ( ! isInContour ) {

		return false;

	}

	for ( let i = 0, l = holes.length; i < l; i ++ ) {

		const isInHole = calculateAngleSum( holes[ i ], x, y ) > 3.14;
		if ( isInHole ) {

			return false;

		}

	}

	return true;

}

function getInnerPoints( polygon, resolution ) {

	getPolygonBounds( polygon, _min, _max );

	const result = [];
	for ( let x = _min.x, lx = _max.x; x < lx; x += resolution ) {

		for ( let y = _min.y, ly = _max.y; y < ly; y += resolution ) {

			if ( pointIsInPolygon( polygon, x, y ) ) {

				result.push( [ x, y ] );

			}

		}

	}

	return result;

}

export function constructPolygonMeshObject( polygons, options = {} ) {

	const {
		thickness = 0,
		offset = 0,
		generateNormals = true,
		flat = false,
		ellipsoid = null,
		resolution = null,
	} = options;

	// clean up, filter, and ensure winding order of the polygon shapes,
	// then split the polygon into separate components
	const cleanedPolygons = cleanPolygons( polygons )
		.flatMap( polygon => splitPolygon( polygon ) );

	const triangulations = cleanedPolygons.map( polygon => {

		let innerPoints = [];
		if ( resolution !== null ) {

			innerPoints = getInnerPoints( polygon, resolution );

			polygon = polygon.map( loop => {

				return resampleLine( loop, resolution );

			} );

		}

		// remove the last point since it's redundant
		polygon.forEach( loop => {

			loop.pop();

		} );

		const [ contour, ...holes ] = polygon;
		return triangulate( contour, holes, innerPoints );

	} );

	// calculate the total number of vertices needed
	let totalVerts = 0;
	triangulations.forEach( ( { points } ) => {

		totalVerts += points.length;

	} );

	if ( thickness > 0 ) {

		totalVerts *= 2;

	}

	// collect the points
	let index = 0;
	const halfOffset = totalVerts / 2;
	const posArray = new Array( totalVerts * 3 );
	triangulations.forEach( ( { points } ) => {

		// add all vertices in the tool to the subsequent section of the array
		for ( let i = 0, l = points.length; i < l; i ++ ) {

			const p = points[ i ];
			_vec.x = p[ 0 ];
			_vec.y = p[ 1 ];
			_vec.z = p[ 2 ] || 0;

			_vec.z = flat ? offset : _vec.z + offset;
			_vec.toArray( posArray, index );

			if ( thickness > 0 ) {

				_vec.z += thickness;
				_vec.toArray( posArray, index + 3 * halfOffset );

			}

			index += 3;

		}

	} );

	// construct the list of indices
	const indexArray = [];
	let indexOffset = 0;
	triangulations.forEach( ( { indices, points, edges } ) => {

		// construct caps
		for ( let i = 0, l = indices.length; i < l; i += 3 ) {

			if ( thickness > 0 ) {

				indexArray.push( indices[ i + 0 ] + indexOffset );
				indexArray.push( indices[ i + 1 ] + indexOffset );
				indexArray.push( indices[ i + 2 ] + indexOffset );

				indexArray.push( indices[ i + 2 ] + indexOffset + halfOffset );
				indexArray.push( indices[ i + 1 ] + indexOffset + halfOffset );
				indexArray.push( indices[ i + 0 ] + indexOffset + halfOffset );

			} else {

				indexArray.push( indices[ i + 2 ] + indexOffset );
				indexArray.push( indices[ i + 1 ] + indexOffset );
				indexArray.push( indices[ i + 0 ] + indexOffset );

			}

		}

		// construct sides
		if ( thickness > 0 ) {

			// TODO: holes need to be added in reverse here?
			for ( let i = 0, l = edges.length; i < l; i ++ ) {

				const edge = edges[ i ];
				const i0 = edge[ 0 ] + indexOffset;
				const i1 = edge[ 1 ] + indexOffset;
				const i2 = i0 + halfOffset;
				const i3 = i1 + halfOffset;
				indexArray.push( i0, i2, i1 );
				indexArray.push( i1, i2, i3 );

			}

		}

		indexOffset += points.length;

	} );

	// transform the points to the ellipsoid
	if ( ellipsoid ) {

		transformToEllipsoid( posArray, ellipsoid );

	}

	// center the geometry
	const mesh = new Mesh();
	getCenter( posArray, mesh.position );
	_vec.copy( mesh.position ).multiplyScalar( - 1 );
	offsetPoints( posArray, ..._vec );

	mesh.geometry.setIndex( indexArray );
	mesh.geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( posArray ), 3, false ) );

	if ( generateNormals ) {

		// to compute vertex normals we need to remove indices
		mesh.geometry = mesh.geometry.toNonIndexed();
		mesh.geometry.computeVertexNormals();

	}

	return mesh;

}
