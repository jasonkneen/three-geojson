import { Vector3, ShapeUtils, BufferAttribute, Mesh } from 'three';
import { unkinkPolygon } from '@turf/unkink-polygon';
import { dedupeCoordinates } from './GeoJSONShapeUtils.js';
import { getCenter, offsetPoints, transformToEllipsoid } from './FlatVertexBufferUtils.js';

const _vec = new /* @__PURE__ */ Vector3();

export function constructPolygonMeshObject( polygons, options = {} ) {

	const {
		thickness = 0,
		offset = 0,
		generateNormals = true,
		flat = false,
		ellipsoid = null,
	} = options;

	// unkink polygons function will fail if there are duplicate vertices
	const clonedData = polygons
		.map( shape => shape.map( loop => loop.slice() ) )
		.map( shape => {

			return shape.map( loop => dedupeCoordinates( loop ) ).filter( loop => loop.length > 3 );

		} )
		.filter( shape => shape.length !== 0 );

	const data = unkinkPolygon( { type: 'MultiPolygon', coordinates: clonedData } )
		.features.map( feature => feature.geometry.coordinates );

	// remove last point
	data.forEach( shape => {

		shape.forEach( loop => loop.pop() );

	} );


	// calculate the total number of positions needed for the geometry
	let totalVerts = 0;
	const vectorPolygons = data.map( shape => shape.map( loop => loop.map( v => new Vector3( ...v ) ) ) );
	vectorPolygons.forEach( shape => {

		const [ contour, ...holes ] = shape;
		totalVerts += contour.length;
		holes.forEach( hole => totalVerts += hole.length );

		// fix the shape orientations since the spec is a bit ambiguous here and old versions did not
		// specify winding order
		if ( ! ShapeUtils.isClockWise( shape ) ) {

			shape.reverse();

		}

		holes.forEach( hole => {

			if ( ShapeUtils.isClockWise( hole ) ) {

				hole.reverse();

			}

		} );

	} );

	if ( thickness > 0 ) {

		totalVerts *= 2;

	}

	// scratch vector
	const temp = new Vector3();

	// construct the list of positions
	let index = 0;
	const halfOffset = totalVerts / 2;
	const posArray = new Array( totalVerts * 3 );
	vectorPolygons.forEach( polygon => {

		const [ shape, ...holes ] = polygon;
		addVerts( shape );
		holes.forEach( hole => addVerts( hole ) );

		function addVerts( verts ) {

			for ( let i = 0, l = verts.length; i < l; i ++ ) {

				temp.copy( verts[ i ] );
				temp.z = flat ? offset : temp.z + offset;
				temp.toArray( posArray, index );

				if ( thickness > 0 ) {

					temp.z += thickness;
					temp.toArray( posArray, index + 3 * halfOffset );

				}

				index += 3;

			}

		}

	} );

	// construct the list of indices
	let indexArray = [];
	let indexOffset = 0;
	vectorPolygons.forEach( polygon => {

		const [ shape, ...holes ] = polygon;
		const indices = ShapeUtils.triangulateShape( shape, holes ).flatMap( f => f );

		let totalVerts = shape.length;
		holes.forEach( hole => totalVerts += hole.length );

		// caps
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

		// sides
		if ( thickness > 0 ) {

			let indexOffset2 = indexOffset;
			addSides( shape );
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
