import { Vector3 } from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';

const _vec = /* @__PURE__ */ new Vector3();

// transforms GeoJSON lat, lon, height cartographic coordinates to cartesian
// coordinates based on the provided ellipsoid from 3DTilesRenderer project.
export class GeoJSONTransformer {

	constructor( ellipsoid = WGS84_ELLIPSOID ) {

		this.ellipsoid = ellipsoid.clone();

	}

	transformPoint( vec, target ) {

		return this.ellipsoid.getCartographicToPosition( vec.x, vec.y, vec.z, target );

	}

	transformGeometry( geometry ) {

		const { position } = geometry.attributes;
		for ( let i = 0, l = position.count; i < l; i ++ ) {

			_vec.fromBufferAttribute( position, i );
			this.transformPoint( _vec, _vec );
			position.setXYZ( i, ..._vec );

		}

		return geometry;

	}

}
