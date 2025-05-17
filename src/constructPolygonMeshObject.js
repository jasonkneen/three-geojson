import { BufferAttribute, Mesh, Points, Vector3 } from 'three';
import { correctPolygonWinding, dedupePolygonPoints, getPolygonBounds, splitPolygon } from './PolygonUtils.js';
import { resampleLine } from './GeoJSONShapeUtils.js';
import { triangulate } from './triangulate.js';
import { getCenter, offsetPoints, transformToEllipsoid } from './FlatVertexBufferUtils.js';

const _vec = new /* @__PURE__ */ Vector3();
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
	let cleanedPolygons = polygons
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
	const topArray = [];
	const sidesArray = [];
	const botArray = [];
	triangulations.forEach( ( { indices, points, edges } ) => {

		// construct cap
		const botHeight = offset;
		const topHeight = offset + thickness;
		for ( let i = 0, l = indices.length; i < l; i += 3 ) {

			addPoint( indices[ i + 2 ], topHeight, topArray );
			addPoint( indices[ i + 1 ], topHeight, topArray );
			addPoint( indices[ i + 0 ], topHeight, topArray );

			if ( thickness > 0 ) {

				addPoint( indices[ i + 0 ], botHeight, botArray );
				addPoint( indices[ i + 1 ], botHeight, botArray );
				addPoint( indices[ i + 2 ], botHeight, botArray );

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

				addPoint( i0, botHeight, sidesArray );
				addPoint( i2, topHeight, sidesArray );
				addPoint( i1, botHeight, sidesArray );

				addPoint( i1, botHeight, sidesArray );
				addPoint( i2, topHeight, sidesArray );
				addPoint( i3, topHeight, sidesArray );

			}

		}

		function addPoint( index, offset, arr ) {

			const point = points[ index ];
			const z = flat ? 0 : ( point[ 2 ] || 0 );
			arr.push( point[ 0 ], point[ 1 ], z + offset );

		}

	} );

	// transform the points to the ellipsoid
	const posArray = [ ...topArray, ...botArray, ...sidesArray ];
	if ( ellipsoid ) {

		transformToEllipsoid( posArray, ellipsoid );

	}

	// center the geometry
	const mesh = new Mesh();
	getCenter( posArray, mesh.position );
	_vec.copy( mesh.position ).multiplyScalar( - 1 );
	offsetPoints( posArray, ..._vec );

	mesh.geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( posArray ), 3, false ) );

	if ( generateNormals ) {

		// to compute vertex normals we need to remove indices
		mesh.geometry.computeVertexNormals();

	}

	return mesh;

}
