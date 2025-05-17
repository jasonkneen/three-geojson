import { BufferAttribute, MathUtils, Mesh, Points, Vector3 } from 'three';
import { correctPolygonWinding, dedupePolygonPoints, getPolygonBounds, splitPolygon } from './PolygonUtils.js';
import { resampleLine } from './GeoJSONShapeUtils.js';
import { triangulate } from './triangulate.js';
import { getCenter, offsetPoints, transformToEllipsoid } from './FlatVertexBufferUtils.js';

const _vec = new /* @__PURE__ */ Vector3();
const _dir1 = new /* @__PURE__ */ Vector3();
const _dir2 = new /* @__PURE__ */ Vector3();
const _min = new /* @__PURE__ */ Vector3();
const _max = new /* @__PURE__ */ Vector3();

function getInnerPoints( polygon, resolution ) {

	getPolygonBounds( polygon, _min, _max );

	// align all points to a common grid so other polygons will line up
	const startX = Math.sign( _min.x ) * Math.ceil( Math.abs( _min.x / resolution ) ) * resolution;
	const startY = Math.sign( _min.y ) * Math.ceil( Math.abs( _min.y / resolution ) ) * resolution;

	const result = [];
	for ( let x = startX, lx = _max.x; x < lx; x += resolution ) {

		for ( let y = startY, ly = _max.y; y < ly; y += resolution ) {

			result.push( [ x, y ] );

		}

	}

	return result;

}

function addFaceNormals( index, posArray, normalArray ) {

	_vec.fromArray( posArray, index );
	_dir1.fromArray( posArray, index + 3 ).sub( _vec );
	_dir2.fromArray( posArray, index + 6 ).sub( _vec );

	_vec.crossVectors( _dir1, _dir2 ).normalize();
	_vec.toArray( normalArray, index );
	_vec.toArray( normalArray, index + 3 );
	_vec.toArray( normalArray, index + 6 );

}

export function constructPolygonMeshObject( polygons, options = {} ) {

	const {
		thickness = 0,
		offset = 0,
		flat = false,
		ellipsoid = null,
		resolution = null,
	} = options;

	// clone, clean up, filter, and ensure winding order of the polygon shapes,
	// then split the polygon into separate components
	let cleanedPolygons = polygons
		.map( polygon => polygon.map( loop => loop.map( coord => coord.slice() ) ) )
		.map( polygon => dedupePolygonPoints( polygon ) )
		.filter( polygon => polygon.length !== 0 )
		.flatMap( polygon => splitPolygon( polygon ) )
		.map( polygon => correctPolygonWinding( polygon ) );

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

	// collect the points
	let capVertices = 0;
	let edgeVertices = 0;
	triangulations.forEach( ( { indices, edges } ) => {

		capVertices += indices.length;
		edgeVertices += edges.length * 2 * 3;

	} );

	const totalVerts = thickness === 0 ? capVertices : ( 2 * capVertices + edgeVertices );
	const posArray = new Array( totalVerts * 3 );
	const normalArray = new Float32Array( totalVerts * 3 );
	let topOffset = 0;
	let botOffset = capVertices * 3;
	let sideOffset = capVertices * 2 * 3;
	triangulations.forEach( ( { indices, points, edges } ) => {

		// construct cap
		const botHeight = offset;
		const topHeight = offset + thickness;
		for ( let i = 0, l = indices.length; i < l; i += 3 ) {

			addPoint( indices[ i + 2 ], topHeight, topOffset + 0 );
			addPoint( indices[ i + 1 ], topHeight, topOffset + 3 );
			addPoint( indices[ i + 0 ], topHeight, topOffset + 6 );
			topOffset += 9;

			if ( thickness > 0 ) {

				addPoint( indices[ i + 0 ], botHeight, botOffset + 0 );
				addPoint( indices[ i + 1 ], botHeight, botOffset + 3 );
				addPoint( indices[ i + 2 ], botHeight, botOffset + 6 );
				botOffset += 9;

			}

		}

		// construct sides
		if ( thickness > 0 ) {

			// TODO: holes need to be added in reverse here?
			for ( let i = 0, l = edges.length; i < l; i ++ ) {

				const edge = edges[ i ];
				const i0 = edge[ 0 ];
				const i1 = edge[ 1 ];
				const i2 = i0;
				const i3 = i1;

				addPoint( i0, botHeight, sideOffset + 0 );
				addPoint( i2, topHeight, sideOffset + 3 );
				addPoint( i1, botHeight, sideOffset + 6 );
				sideOffset += 9;

				addPoint( i1, botHeight, sideOffset + 0 );
				addPoint( i2, topHeight, sideOffset + 3 );
				addPoint( i3, topHeight, sideOffset + 6 );
				sideOffset += 9;

			}

		}

		function addPoint( index, zOffset, indexOffset ) {

			const point = points[ index ];
			const z = flat ? 0 : ( point[ 2 ] || 0 );
			posArray[ indexOffset + 0 ] = point[ 0 ];
			posArray[ indexOffset + 1 ] = point[ 1 ];
			posArray[ indexOffset + 2 ] = z + zOffset;

		}

	} );

	// transform the points to the ellipsoid
	if ( ellipsoid ) {

		for ( let i = 0; i < capVertices * 3; i += 3 ) {

			const lon = posArray[ i + 0 ] * MathUtils.DEG2RAD;
			const lat = posArray[ i + 1 ] * MathUtils.DEG2RAD;
			ellipsoid.getCartographicToNormal( lat, lon, _vec );

			normalArray[ i + 0 ] = _vec.x;
			normalArray[ i + 1 ] = _vec.y;
			normalArray[ i + 2 ] = _vec.z;

			if ( thickness > 0 ) {

				normalArray[ capVertices * 3 + i + 0 ] = _vec.x;
				normalArray[ capVertices * 3 + i + 1 ] = _vec.y;
				normalArray[ capVertices * 3 + i + 2 ] = - _vec.z;

			}

		}

		transformToEllipsoid( posArray, ellipsoid );

	} else {

		for ( let i = 0; i < capVertices * 3; i += 3 ) {

			normalArray[ i + 0 ] = 0;
			normalArray[ i + 1 ] = 0;
			normalArray[ i + 2 ] = 1;

			if ( thickness > 0 ) {

				normalArray[ capVertices * 3 + i + 0 ] = 0;
				normalArray[ capVertices * 3 + i + 1 ] = 0;
				normalArray[ capVertices * 3 + i + 2 ] = - 1;

			}

		}

	}

	// calculate the post-transformed side normals
	if ( thickness > 0 ) {

		for ( let i = capVertices * 2 * 3; i < normalArray.length; i += 9 ) {

			addFaceNormals( i, posArray, normalArray );

		}

	}

	// center the geometry
	const mesh = new Mesh();
	getCenter( posArray, mesh.position );
	_vec.copy( mesh.position ).multiplyScalar( - 1 );
	offsetPoints( posArray, ..._vec );

	mesh.geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( posArray ), 3, false ) );
	mesh.geometry.setAttribute( 'normal', new BufferAttribute( normalArray, 3, false ) );

	return mesh;

}
