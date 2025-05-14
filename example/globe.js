import {
	PerspectiveCamera,
	Scene,
	WebGLRenderer,
	Group,
	Box3,
	Vector3,
	Mesh,
	SphereGeometry,
	MeshBasicMaterial,
	Clock,
	MeshStandardMaterial,
	DirectionalLight,
	AmbientLight,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GeoJSONLoader } from '../src/index.js';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';

// camera
const camera = new PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 1000 );
camera.position.x = - 2;
camera.position.y = 1;
camera.position.z = - 1;

// scene
const scene = new Scene();

// renderer
const renderer = new WebGLRenderer( { antialias: true } );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

// controls
const clock = new Clock();
const controls = new OrbitControls( camera, renderer.domElement );
controls.minDistance = 1;
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1;

// lights
const directionalLight = new DirectionalLight( 0xffffff, 3.5 );
directionalLight.position.set( 1, 2, 0 );

const ambientLight = new AmbientLight( 0xffffff, 1.0 );
scene.add( directionalLight, ambientLight );

// construct geo group
const group = new Group();
group.rotation.x = - Math.PI / 2;
scene.add( group );

// load geojson
const url = new URL( './world.geojson', import.meta.url );
new GeoJSONLoader()
	.loadAsync( url )
	.then( res => {

		// add base globe color
		const globeBase = new Mesh(
			new SphereGeometry( 1, 100, 50 ),
			new MeshBasicMaterial( {
				color: 0x222222,
				transparent: true,
				opacity: 0.75,
				depthWrite: false,

				polygonOffset: true,
				polygonOffsetFactor: 1,
				polygonOffsetUnits: 1,
			} ),
		);
		globeBase.scale.copy( WGS84_ELLIPSOID.radius );
		group.add( globeBase );

		// load the globe lines
		res.polygons.forEach( geom => {

			const line = geom.getLineObject( {
				ellipsoid: WGS84_ELLIPSOID,
			} );
			group.add( line );

		} );

		res.features
			.filter( f => /Japan/.test( f.properties.name ) )
			.flatMap( f => f.polygons )
			.forEach( geom => {

				const mesh = geom.getMeshObject( {
					thickness: 1e5,
					ellipsoid: WGS84_ELLIPSOID,
				} );
				mesh.material = new MeshStandardMaterial();
				group.add( mesh );

			} );

		// scale and center the model
		const box = new Box3();
		box.setFromObject( group );
		box.getCenter( group.position ).multiplyScalar( - 1 );

		const size = new Vector3();
		box.getSize( size );
		group.scale.setScalar( 1.5 / Math.max( ...size ) );
		group.position.multiplyScalar( group.scale.x );

		console.log( res );

	} );

onResize();
window.addEventListener( 'resize', onResize );

// animation
function animate() {

	controls.update( Math.min( clock.getDelta(), 64 / 1000 ) );
	renderer.render( scene, camera );

}

function onResize() {

	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setPixelRatio( window.devicePixelRatio );

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

}
