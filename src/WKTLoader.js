import { GeoJSONLoader } from './GeoJSONLoader.js';
import { parse } from 'wellknown';

export class WKTLoader extends GeoJSONLoader {

	parse( text ) {

		return super.parse( parse( text ) );

	}

}
