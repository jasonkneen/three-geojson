import { Vector3, ShapeUtils, BufferAttribute, Mesh } from 'three';
import { unkinkPolygon } from '@turf/unkink-polygon';
import { dedupeCoordinates } from './GeoJSONShapeUtils.js';
import { getCenter, offsetPoints, transformToEllipsoid } from './FlatVertexBufferUtils.js';

const _vec = new /* @__PURE__ */ Vector3();
const _min = new /* @__PURE__ */ Vector3();
const _max = new /* @__PURE__ */ Vector3();
const _center = new /* @__PURE__ */ Vector3();

function splitPolygon( polygon ) {

	// find the bounds of the shape
	getPolygonBounds( polygon, _min, _max );
	_center.addVectors( _min, _max ).multiplyScalar( 0.5 );

	// offset the shape to near zero to improve precision
	polygon.forEach( loop => loop.forEach( coord => {

		coord[ 0 ] -= _center.x;
		coord[ 1 ] -= _center.y;

	} ) );

	// unkink the polygon
	const fixedPolygons = unkinkPolygon( { type: 'Polygon', coordinates: polygon } )
		.features.map( feature => feature.geometry.coordinates );

	// Reset the centering
	fixedPolygons.forEach( shape => shape.forEach( loop => loop.forEach( coord => {

		coord[ 0 ] += _center.x;
		coord[ 1 ] += _center.y;

	} ) ) );

	// Fix the 2d offset
	if ( fixedPolygons.length > 1 && this.dimension > 2 ) {

		fixedPolygons.forEach( shape => shape.forEach( loop => loop.forEach( coord => {

			if ( coord.length === 2 ) {

				coord[ 2 ] = _center.z;

			}

		} ) ) );

	}

	return fixedPolygons;

}

function getPolygonBounds( polygon, min, max ) {

	min.setScalar( Infinity );
	max.setScalar( - Infinity );
	polygon.forEach( loop => loop.forEach( coord => {

		const [ x, y, z = 0 ] = coord;
		min.x = Math.min( min.x, x );
		min.y = Math.min( min.y, y );
		min.z = Math.min( min.z, z );

		max.x = Math.max( max.x, x );
		max.y = Math.max( max.y, y );
		max.z = Math.max( max.z, z );

	} ) );

}

function cleanPolygons( polygons ) {

	// clone each polygon with deduped set of vertices
	const dedeupedPolygons = polygons
		.map( polygon => {

			return polygon
				.map( loop => dedupeCoordinates( loop.slice() ) )
				.filter( loop => loop.length > 3 );

		} );

	return dedeupedPolygons.filter( shape => shape.length !== 0 );

}

function countVerticesInPolygons( polygons ) {

	let total = 0;
	polygons.forEach( polygon => {

		polygon.forEach( loop => {

			total += loop.length;

		} );

	} );

	return total;

}

export function constructPolygonMeshObject( polygons, options = {} ) {

	const {
		thickness = 0,
		offset = 0,
		generateNormals = true,
		flat = false,
		ellipsoid = null,
	} = options;

	// clean up and filter the polygon shapes, then split the polygon into separate components
	const cleanedPolygons = cleanPolygons( polygons )
		.flatMap( polygon => splitPolygon( polygon ) );

	// remove last point
	cleanedPolygons.forEach( shape => {

		shape.forEach( loop => loop.pop() );

	} );

	// calculate the total number of positions needed for the geometry
	let totalVerts = countVerticesInPolygons( cleanedPolygons );
	if ( thickness > 0 ) {

		totalVerts *= 2;

	}

	// construct a series of Vector3 loops and correct the winding order
	const vectorPolygons = cleanedPolygons.map( shape => shape.map( loop => loop.map( v => new Vector3( ...v ) ) ) );
	vectorPolygons.forEach( polygon => {

		// fix the shape orientations since the spec is a bit ambiguous here and old versions did not
		// specify winding order
		const [ contour, ...holes ] = polygon;
		if ( ! ShapeUtils.isClockWise( contour ) ) {

			contour.reverse();

		}

		holes.forEach( hole => {

			if ( ShapeUtils.isClockWise( hole ) ) {

				hole.reverse();

			}

		} );

	} );

	// construct the list of positions
	let index = 0;
	const halfOffset = totalVerts / 2;
	const posArray = new Array( totalVerts * 3 );
	vectorPolygons.forEach( polygon => {

		const [ contour, ...holes ] = polygon;
		addVerts( contour );
		holes.forEach( hole => addVerts( hole ) );

		function addVerts( loop ) {

			// add all vertices in the tool to the subsequent section of the array
			for ( let i = 0, l = loop.length; i < l; i ++ ) {

				_vec.copy( loop[ i ] );
				_vec.z = flat ? offset : _vec.z + offset;
				_vec.toArray( posArray, index );

				if ( thickness > 0 ) {

					_vec.z += thickness;
					_vec.toArray( posArray, index + 3 * halfOffset );

				}

				index += 3;

			}

		}

	} );

	// construct the list of indices
	let indexArray = [];
	let indexOffset = 0;
	vectorPolygons.forEach( polygon => {

		const [ contour, ...holes ] = polygon;
		const indices = ShapeUtils.triangulateShape( contour, holes ).flatMap( f => f );

		let totalVerts = contour.length;
		holes.forEach( hole => totalVerts += hole.length );

		// construct caps
		for ( let i = 0, l = indices.length; i < l; i += 3 ) {

			if ( thickness > 0 ) {

				indexArray.push( indices[ i + 2 ] + indexOffset );
				indexArray.push( indices[ i + 1 ] + indexOffset );
				indexArray.push( indices[ i + 0 ] + indexOffset );

				indexArray.push( indices[ i + 0 ] + indexOffset + halfOffset );
				indexArray.push( indices[ i + 1 ] + indexOffset + halfOffset );
				indexArray.push( indices[ i + 2 ] + indexOffset + halfOffset );

			} else {

				indexArray.push( indices[ i + 0 ] + indexOffset );
				indexArray.push( indices[ i + 1 ] + indexOffset );
				indexArray.push( indices[ i + 2 ] + indexOffset );

			}

		}

		// construct sides
		if ( thickness > 0 ) {

			let indexOffset2 = indexOffset;
			addSides( contour );
			holes.forEach( hole => addSides( hole ) );

			function addSides( verts ) {

				for ( let i = 0, l = verts.length; i < l; i ++ ) {

					const i0 = indexOffset2 + i;
					const i1 = indexOffset2 + ( i + 1 ) % l;
					const i2 = i0 + halfOffset;
					const i3 = i1 + halfOffset;

					indexArray.push( i0, i2, i1 );
					indexArray.push( i1, i2, i3 );

				}

				indexOffset2 += verts.length;

			}

		}

		indexOffset += totalVerts;

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
