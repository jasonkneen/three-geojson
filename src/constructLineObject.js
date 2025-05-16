import { BufferAttribute, LineSegments, Vector3 } from 'three';
import { getCenter, offsetPoints, transformToEllipsoid } from './FlatVertexBufferUtils.js';

const _vec = new /* @__PURE__ */ Vector3();

// Takes a set of vertex data and constructs a line segment
export function constructLineObject( lineStrings, options = {} ) {

	const {
		flat = false,
		offset = 0,
		ellipsoid = null,
	} = options;

	// calculate total segments
	let totalSegments = 0;
	lineStrings.forEach( vertices => {

		const segments = vertices.length - 1;
		totalSegments += segments * 2;

	} );

	// roll up all the vertices
	let index = 0;
	const posArray = new Array( totalSegments * 3 );
	lineStrings.forEach( vertices => {

		const length = vertices.length;
		const segments = length - 1;
		for ( let i = 0; i < segments; i ++ ) {

			const ni = ( i + 1 ) % length;

			const v0 = vertices[ i ];
			const v1 = vertices[ ni ];
			posArray[ index + 0 ] = v0[ 0 ];
			posArray[ index + 1 ] = v0[ 1 ];
			posArray[ index + 2 ] = ( flat ? 0 : v0[ 2 ] || 0 ) + offset;

			posArray[ index + 3 ] = v1[ 0 ];
			posArray[ index + 4 ] = v1[ 1 ];
			posArray[ index + 5 ] = ( flat ? 0 : v1[ 2 ] || 0 ) + offset;

			index += 6;

		}

	} );

	// transform the points to the ellipsoid
	if ( ellipsoid ) {

		transformToEllipsoid( posArray, ellipsoid );

	}

	// center the shape
	const line = new LineSegments();
	getCenter( posArray, line.position );
	_vec.copy( line.position ).multiplyScalar( - 1 );
	offsetPoints( posArray, ..._vec );

	line.geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( posArray ), 3, false ) );

	return line;

}
