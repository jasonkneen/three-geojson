import { ShapePath } from 'three';

export class GeoJSONLoader {

	constructor() {

		this.fetchOptions = {};

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

		const { type } = json;

	}

}
