import {
	PerspectiveCamera,
	Scene,
	WebGLRenderer,
	Group,
	Line,
	Box3,
	Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GeoJSONLoader } from '../src/index.js';

// init
const camera = new PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 1000 );
camera.position.z = 2;

const scene = new Scene();

const renderer = new WebGLRenderer( { antialias: true } );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls( camera, renderer.domElement );

const url = 'https://raw.githubusercontent.com/openlayers/openlayers/refs/heads/main/examples/data/geojson/polygon-samples.geojson';
new GeoJSONLoader()
	.loadAsync( url )
	.then( res => {

		const group = new Group();
		scene.add( group );

		res.geometries.forEach( geom => {

			const line = new Line();
			line.geometry.setFromPoints( geom.data.shape );
			group.add( line );

		} );

		const box = new Box3();
		box.setFromObject( group );
		box.getCenter( group.position ).multiplyScalar( - 1 );

		const size = new Vector3();
		box.getSize( size );
		group.scale.setScalar( 1 / Math.max( ...size ) );
		group.position.multiplyScalar( group.scale.x );

		console.log( res );

	} );

onResize();
window.addEventListener( 'resize', onResize );

// animation
function animate() {

	renderer.render( scene, camera );

}

function onResize() {

	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setPixelRatio( window.devicePixelRatio );

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

}
