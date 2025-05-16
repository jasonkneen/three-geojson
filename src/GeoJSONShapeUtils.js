// Removes any duplicate vertices
export function dedupeCoordinates( coords ) {

	for ( let i = 0; i < coords.length - 1; i ++ ) {

		const ni = ( i + 1 ) % coords.length;
		const c = coords[ i ];
		const nc = coords[ ni ];

		if ( c[ 0 ] === nc[ 0 ] && c[ 1 ] === nc[ 1 ] ) {

			coords.splice( ni, 1 );
			i --;

		}

	}

	return coords;

}

// Retrieve the coordinate dimension
export function getDimension( coordinates ) {

	return coordinates?.length ?? null;

}

// Extract the non-schema keys from the GeoJSON object
export function extractForeignKeys( object ) {

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

// Traverse the parsed tree
export function traverse( object, callback ) {

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

export function resampleLine( loop, minDistance ) {

	const result = [];
	for ( let i = 0, li = loop.length; i < li - 1; i ++ ) {

		const ni = ( i + 1 ) % li;
		const c = loop[ i ];
		const nc = loop[ ni ];

		const dx = nc[ 0 ] - c[ 0 ];
		const dy = nc[ 1 ] - c[ 1 ];
		const dist = Math.sqrt( dx ** 2 + dy ** 2 );
		const steps = Math.ceil( dist / minDistance );

		result.push( c );

		const [ cx, cy ] = c;
		for ( let j = 1; j < steps; j ++ ) {

			result.push( [ cx + dx * j / steps, cy + dy * j / steps ] );

		}

	}

	return result;

}
