import { Box3, Vector3, ShapeUtils, BufferAttribute, Mesh, LineSegments } from 'three';
import { unkinkPolygon } from '@turf/unkink-polygon';

// Removes any duplicate vertices
function dedupeCoordinates( coords ) {

	for ( let i = 0; i < coords.length - 1; i ++ ) {

		const ni = ( i + 1 ) % coords.length;
		const c = coords[ i ];
		const nc = coords[ ni ];

		if ( c[ 0 ] === nc[ 0 ] && c[ 1 ] === nc[ 1 ] ) {

			coords.splice( ni, 1 );
			i --;

		}

	}

}

// Extract the non-schema keys from the GeoJSON object
function extractForeignKeys( object ) {

	const result = { ...object };
	delete result.type;
	delete result.bbox;

	switch ( object.type ) {

		case 'Point':
		case 'MultiPoint':
		case 'LineString':
		case 'MultiLineString':
		case 'Polygon':
		case 'MultiPolygon':

			delete result.coordinates;
			break;

		case 'GeometryCollection':

			delete result.geometries;
			break;

		case 'Feature':

			delete result.id;
			delete result.properties;
			delete result.geometry;
			break;

		case 'FeatureCollection':

			delete result.features;
			break;

	}

	return result;

}

// Parse the bounds to a three.js Box3
function parseBounds( arr ) {

	if ( ! arr ) {

		return null;

	} else if ( arr.length === 4 ) {

		const box = new Box3();
		box.min.set( arr[ 0 ], arr[ 1 ], 0 );
		box.max.set( arr[ 2 ], arr[ 3 ], 0 );
		return box;

	} else if ( arr.length === 6 ) {

		const box = new Box3();
		box.min.set( arr[ 0 ], arr[ 1 ], arr[ 2 ] );
		box.max.set( arr[ 3 ], arr[ 4 ], arr[ 5 ] );
		return box;

	}

}

// Get the base object definition for GeoJSON type
function getBase( object ) {

	return {
		type: object.type,
		boundingBox: parseBounds( object.bbox ),
		data: null,
		foreign: extractForeignKeys( object ),
	};

}

// Retrieve the coordinate dimension
function getDimension( coordinates ) {

	return coordinates?.length ?? null;

}

// Parse a coordinate to a three.js Vector3
function parseCoordinate( arr ) {

	return arr.length === 2 ?
		new Vector3( ...arr, 0 ) :
		new Vector3( ...arr );

}

// Traverse the parsed tree
function traverse( object, callback ) {

	callback( object );

	switch ( object.type ) {

		case 'GeometryCollection':
		case 'FeatureCollection':

			object.data.forEach( o => traverse( o, callback ) );
			break;

		case 'Feature':
			traverse( object.data, callback );
			break;

	}

}

// Takes a set of vertex data and constructs a line segment
function constructLineObject( lineData, options = {} ) {

	const {
		flat = false,
		loop = false,
		offset = 0,
	} = options;

	// calculate total segments
	let totalSegments = 0;
	lineData.forEach( vertices => {

		const segments = loop ? vertices.length : vertices.length - 1;
		totalSegments += segments * 2;

	} );

	// roll up all the vertices
	let index = 0;
	const posArray = new Float32Array( totalSegments * 3 );
	lineData.forEach( vertices => {

		const length = vertices.length;
		const segments = loop ? length : length - 1;
		for ( let i = 0; i < segments; i ++ ) {

			const ni = ( i + 1 ) % length;

			const v0 = vertices[ i ];
			const v1 = vertices[ ni ];
			posArray[ index + 0 ] = v0[ 0 ];
			posArray[ index + 1 ] = v0[ 1 ];
			posArray[ index + 2 ] = ( flat ? v0[ 2 ] || 0 : 0 ) + offset;

			posArray[ index + 3 ] = v1[ 0 ];
			posArray[ index + 4 ] = v1[ 1 ];
			posArray[ index + 5 ] = ( flat ? v1[ 2 ] || 0 : 0 ) + offset;

			index += 6;

		}

	} );

	const line = new LineSegments();
	line.geometry.setAttribute( 'position', new BufferAttribute( posArray, 3, false ) );

	return line;

}

// Shape construction functions
function getLineObject( options = {} ) {

	return constructLineObject( this.data.flatMap( line => line ), {
		loop: false,
		...options,
 	} );


}

function getPolygonLineObject( options = {} ) {

	return constructLineObject( this.data.flatMap( shape => shape ), {
		loop: true,
		...options,
	} );

}

function getPolygonMeshObject( options = {} ) {

	const {
		thickness = 0,
		offset = 0,
		generateNormals = true,
		flat = false,
	} = options;

	// calculate the total number of positions needed for the geometry
	let totalVerts = 0;
	const polygons = this.data.map( shape => shape.map( loop => loop.map( v => new Vector3( ...v ) ) ) );
	polygons.forEach( shape => {

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
	const posArray = new Float32Array( totalVerts * 3 );
	polygons.forEach( polygon => {

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
	polygons.forEach( polygon => {

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

	const mesh = new Mesh();
	mesh.geometry.setIndex( indexArray );
	mesh.geometry.setAttribute( 'position', new BufferAttribute( posArray, 3, false ) );

	if ( generateNormals ) {

		// to compute vertex normals we need to remove indices
		mesh.geometry = mesh.geometry.toNonIndexed();
		mesh.geometry.computeVertexNormals();

	}

	return mesh;


}

// Parser for GeoJSON https://geojson.org/
export class GeoJSONLoader {

	constructor() {

		this.fetchOptions = {};
		this.decomposePolygons = true;

	}

	loadAsync( url ) {

		return fetch( url )
			.then( res => res.json() )
			.then( json => this.parse( json ) );

	}

	parse( json ) {

		if ( typeof json === 'string' ) {

			json = JSON.parse( json );

		}

		const root = this.parseObject( json );
		const features = [];
		const geometries = [];

		traverse( root, object => {

			if ( object.type !== 'FeatureCollection' && object.type !== 'GeometryCollection' ) {

				if ( object.type === 'Feature' ) {

					features.push( object );

				} else {

					geometries.push( object );

					if ( object.feature ) {

						object.feature.geometries.push( object );

					}

				}

			}

		} );

		features.forEach( feature => {

			const { geometries } = feature;
			feature.points = geometries.filter( object => /Point/.test( object.type ) );
			feature.lines = geometries.filter( object => /Line/.test( object.type ) );
			feature.polygons = geometries.filter( object => /Polygon/.test( object.type ) );

		} );

		return {
			features,
			geometries,
			points: geometries.filter( object => /Point/.test( object.type ) ),
			lines: geometries.filter( object => /Line/.test( object.type ) ),
			polygons: geometries.filter( object => /Polygon/.test( object.type ) ),
		};

	}

	parseObject( object, feature = null ) {

		switch ( object.type ) {

			case 'Point': {

				return {
					...getBase( object ),
					feature,
					data: [ object.coordinates ],
					dimension: getDimension( object.coordinates ),
				};

			}

			case 'MultiPoint': {

				return {
					...getBase( object ),
					feature,
					data: object.coordinates,
					dimension: getDimension( object.coordinates[ 0 ] ),
				};

			}

			case 'LineString': {

				return {
					...getBase( object ),
					feature,
					data: [ object.coordinates ],
					dimension: getDimension( object.coordinates[ 0 ] ),

					getLineObject,
				};

			}

			case 'MultiLineString': {

				return {
					...getBase( object ),
					feature,
					data: object.coordinates,
					dimension: getDimension( object.coordinates[ 0 ][ 0 ] ),

					getLineObject,
				};

			}

			case 'Polygon': {

				const result = {
					...getBase( object ),
					feature,
					data: [ object.coordinates ],
					dimension: getDimension( object.coordinates[ 0 ][ 0 ] ),

					getLineObject: getPolygonLineObject,
					getMeshObject: getPolygonMeshObject,
				};

				result.data.forEach( shape => {

					shape.forEach( loop => loop.pop() );

				} );

				return result;

			}

			case 'MultiPolygon': {

				const result = {
					...getBase( object ),
					feature,
					data: object.coordinates,
					dimension: getDimension( object.coordinates[ 0 ][ 0 ][ 0 ] ),

					getLineObject: getPolygonLineObject,
					getMeshObject: getPolygonMeshObject,
				};

				result.data.forEach( shape => {

					shape.forEach( loop => loop.pop() );

				} );

				return result;

			}

			case 'GeometryCollection': {

				return {
					...getBase( object ),
					feature,
					data: object.geometries.map( obj => this.parseObject( obj, feature ) ),
				};

			}

			case 'Feature': {

				const feature = {
					...getBase( object ),
					id: object.id ?? null,
					properties: object.properties,
					geometries: [],
					data: null,
				};

				feature.data = this.parseObject( object.geometry, feature );
				return feature;

			}

			case 'FeatureCollection': {

				return {
					...getBase( object ),
					data: object.features.map( feat => this.parseObject( feat ) ),
				};

			}

		}

	}

}
