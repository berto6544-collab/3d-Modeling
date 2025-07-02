import React, { useEffect, useState, useRef, useCallback } from 'react';
import {  
  Box, 
  Move3d, 
  RotateCcw, 
  Maximize, 
  Circle, 
  Cylinder, 
  Triangle,  
  Trash2, 
  Grid3x3,
  ListTree,
  X,
  Axis3D
} from 'lucide-react';
import * as THREE from 'three';
import { menu } from '../../json/menu';
// Mock menu data since it's not provided


export default function MayaInterface() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const selectedObjectRef = useRef(null);
  const transformControlsRef = useRef(null);
  const gridHelperRef = useRef(null);
  const axesHelperRef = useRef(null);
  
  const [showMenu, setShowMenu] = useState({
    outline: false
  });
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [transformMode, setTransformMode] = useState('translate');
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Transform Controls implementation
  const createTransformControls = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
    
    const controls = {
      object: null,
      mode: transformMode,
      attach: (obj) => {
        controls.object = obj;
        if (obj) {
          obj.userData.originalMaterial = obj.material;
          const highlightMaterial = obj.material.clone();
          highlightMaterial.emissive = new THREE.Color(0x444444);
          obj.material = highlightMaterial;
        }
      },
      detach: () => {
        if (controls.object && controls.object.userData.originalMaterial) {
          controls.object.material = controls.object.userData.originalMaterial;
          delete controls.object.userData.originalMaterial;
        }
        controls.object = null;
      },
      setMode: (mode) => {
        controls.mode = mode;
      }
    };
    
    return controls;
  }, [transformMode]);

  // Mouse controls for object manipulation
  const handleMouseDown = useCallback((event) => {
    if (!sceneRef.current || !cameraRef.current) return;
    
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
    
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (obj.userData.isModelObject) {
        setSelectedObject(obj.uuid);
        selectedObjectRef.current = obj;
        if (transformControlsRef.current) {
          transformControlsRef.current.attach(obj);
        }
      }
    } else {
      setSelectedObject(null);
      selectedObjectRef.current = null;
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
      }
    }
  }, []);

  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!selectedObjectRef.current) return;
      
      const obj = selectedObjectRef.current;
      const step = event.shiftKey ? 0.1 : 0.01;
      
      switch (event.key) {
        case 'Delete':
          event.preventDefault();
          removeObject(obj.uuid);
          break;
        case 'g':
          event.preventDefault();
          setTransformMode('translate');
          break;
        case 'r':
          event.preventDefault();
          setTransformMode('rotate');
          break;
        case 's':
          event.preventDefault();
          setTransformMode('scale');
          break;
        case 'ArrowUp':
          event.preventDefault();
          obj.position.y += step;
          break;
        case 'ArrowDown':
          event.preventDefault();
          obj.position.y -= step;
          break;
        case 'ArrowLeft':
          event.preventDefault();
          obj.position.x -= step;
          break;
        case 'ArrowRight':
          event.preventDefault();
          obj.position.x += step;
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(800, 600);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelper.userData.isHelper = true;
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    // Axes
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.userData.isHelper = true;
    axesHelperRef.current = axesHelper;
    scene.add(axesHelper);

    // Simple orbit controls implementation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const handleMouseMove = (event) => {
      if (!isDragging) return;
      
      const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
      };
      
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position);
      
      spherical.theta -= deltaMove.x * 0.01;
      spherical.phi += deltaMove.y * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
      
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);
      
      previousMousePosition = { x: event.clientX, y: event.clientY };
    };
    
    const handleMouseDownOrbit = (event) => {
      if (event.button === 2) {
        isDragging = true;
        previousMousePosition = { x: event.clientX, y: event.clientY };
      }
    };
    
    const handleMouseUp = () => {
      isDragging = false;
    };
    
    const handleWheel = (event) => {
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
    };

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    // Mount renderer
    mountRef.current.appendChild(renderer.domElement);

    // Event listeners
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousedown', handleMouseDownOrbit);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', handleResize);

    // Transform controls
    transformControlsRef.current = createTransformControls();

    // Initial resize
    handleResize();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [backgroundColor, handleMouseDown, createTransformControls]);

  // Update transform mode
  useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(transformMode);
    }
  }, [transformMode]);

  // Update grid and axes visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
    if (axesHelperRef.current) {
      axesHelperRef.current.visible = showAxes;
    }
  }, [showGrid, showAxes]);

  // Add object to scene
  const addObject = (type) => {
    if (!sceneRef.current) return;

    let geometry, material, mesh;
    
    switch (type) {
      case 'cube':
        geometry = new THREE.BoxGeometry();
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry();
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry();
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry();
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry();
        break;
      default:
        return;
    }

    material = new THREE.MeshLambertMaterial({ 
      color: Math.random() * 0xffffff 
    });
    
    mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      (Math.random() - 0.5) * 4,
      Math.random() * 2,
      (Math.random() - 0.5) * 4
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isModelObject = true;
    
    sceneRef.current.add(mesh);
    
    const newObject = {
      id: mesh.uuid,
      type,
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      color: `#${material.color.getHexString()}`
    };
    
    setObjects(prev => [...prev, newObject]);
  };

  // Remove object
  const removeObject = (id) => {
    if (!sceneRef.current) return;
    
    const obj = sceneRef.current.getObjectByProperty('uuid', id);
    if (obj) {
      sceneRef.current.remove(obj);
      obj.geometry.dispose();
      obj.material.dispose();
    }
    
    setObjects(prev => prev.filter(obj => obj.id !== id));
    setSelectedObject(null);
    selectedObjectRef.current = null;
    if (transformControlsRef.current) {
      transformControlsRef.current.detach();
    }
  };

  // Update object color
  const updateObjectColor = (id, color) => {
    if (!sceneRef.current) return;
    
    const obj = sceneRef.current.getObjectByProperty('uuid', id);
    if (obj) {
      obj.material.color.setHex(parseInt(color.slice(1), 16));
    }
    
    setObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, color } : obj
    ));
  };

 

  return (
    <div className="w-full h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Top Menu Bar */}
      <div className="bg-[#131313] border-b border-[#2b2b2b]">
        <div className="flex items-center">
          {menu.map((p, i) => (
            <div key={i} className="relative">
              <button className="hover:bg-[#303030] p-2 px-4 flex-1">{p.name}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#131313] border-b border-[#2b2b2b]">
        <div className="flex items-center gap-2 p-2">
          <button 
            onClick={() => addObject('cube')}
            className="flex items-center gap-1 p-3 bg-[#1c1c1c] hover:bg-[#303030] rounded"
          >
            <Box size={18} />
          </button>
          <button 
            onClick={() => addObject('sphere')}
            className="flex items-center gap-2 p-3 bg-[#1c1c1c] hover:bg-[#303030] rounded"
          >
            <Circle size={18} />
          </button>
          <button 
            onClick={() => addObject('cylinder')}
            className="flex items-center gap-2 p-3 bg-[#1c1c1c] hover:bg-[#303030] rounded"
          >
            <Cylinder size={18} />
          </button>
          <button 
            onClick={() => addObject('cone')}
            className="flex items-center gap-2 p-3 bg-[#1c1c1c] hover:bg-[#303030] rounded"
          >
            <Triangle size={18} />
          </button>
          <button 
            onClick={() => addObject('torus')}
            className="flex items-center gap-2 p-3 bg-[#1c1c1c] hover:bg-[#303030] rounded"
          >
            <Circle size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1">
        <div className="w-14 bg-[#131313] border-r border-[#2b2b2b] flex flex-col">
          <div className="bg-[#131313] p-2 border-b border-[#2b2b2b]">
            <div className="grid grid-cols-1 gap-1">
              <button 
                onClick={() => setTransformMode('translate')} 
                className={`w-10 h-10 rounded flex items-center justify-center ${
                  transformMode === "translate" ? 'bg-[#303030]' : 'bg-[#1c1c1c] hover:bg-[#303030]'
                } cursor-pointer`}
              >
                <Move3d className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setTransformMode('rotate')} 
                className={`w-10 h-10 rounded flex items-center justify-center ${
                  transformMode === "rotate" ? 'bg-[#303030]' : 'bg-[#1c1c1c] hover:bg-[#303030]'
                } cursor-pointer`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setTransformMode('scale')} 
                className={`w-10 h-10 rounded flex items-center justify-center ${
                  transformMode === "scale" ? 'bg-[#303030]' : 'bg-[#1c1c1c] hover:bg-[#303030]'
                } cursor-pointer`}
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-[#131313] p-2 border-b border-[#2b2b2b]">
            <div className="grid grid-cols-1 gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-10 h-10 rounded bg-[#1c1c1c] hover:bg-[#303030] cursor-pointer">
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 p-2 gap-1">
            <button 
              onClick={() => setShowMenu(prev => ({ ...prev, outline: !prev.outline }))} 
              className={`w-10 h-10 rounded flex items-center justify-center ${
                showMenu.outline ? 'bg-[#303030]' : 'bg-[#1c1c1c] hover:bg-[#303030]'
              } cursor-pointer`}
            >
              <ListTree className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => setShowGrid(!showGrid)} 
              className={`w-10 h-10 rounded flex items-center justify-center ${
                showGrid ? 'bg-[#303030]' : 'bg-[#1c1c1c] hover:bg-[#303030]'
              } cursor-pointer`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>

            <button 
              onClick={() => setShowAxes(!showAxes)} 
              className={`w-10 h-10 rounded flex items-center justify-center ${
                showAxes ? 'bg-[#303030]' : 'bg-[#1c1c1c] hover:bg-[#303030]'
              } cursor-pointer`}
            >
              <Axis3D className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Left Sidebar - Outliner */}
        {showMenu.outline && (
          <div className="w-64 bg-[#131313] border-r border-[#2b2b2b] flex flex-col">
            <div className="flex-1 px-3">
              <div className="text-gray-100 p-2 font-bold text-sm mb-3 flex items-center justify-between">
                <span>Outliner</span>
                <button onClick={() => setShowMenu(prev => ({ ...prev, outline: false }))}>
                  <X className="text-sm text-gray-300 hover:text-gray-500 cursor-pointer" />
                </button>
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="mt-3 space-y-1">
                  {objects.map((obj) => (
                    <button 
                      key={obj.id}
                      onClick={()=>{
                        setSelectedObject(null)
                        setSelectedObject(obj.id)
                      }}
                      className={`p-2 w-full ${
                        selectedObject === obj.id ? 'border border-blue-500 bg-blue-900/30 rounded' : 'border-b cursor-pointer border-transparent hover:border-gray-800 text-gray-100 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="capitalize">{obj.type}</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={obj.color}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateObjectColor(obj.id, e.target.value)

                            }}
                            className="w-6 h-6 rounded"
                          />
                          <button 
                            onClick={(e) =>{
                              e.stopPropagation();
                              removeObject(obj.id)
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Center Area */}
        <div className="flex-1 flex flex-col">
          {/* Viewport Area */}
          <div className="flex-1 relative bg-[#131313]">
            {/* Viewport Header */}
            <div className="absolute top-0 left-0 right-0 bg-[#131313] border-b border-[#2b2b2b] flex items-center justify-between z-10">
              <div className="flex items-center">
                <button className="hover:bg-[#303030] text-sm p-2 px-4 flex-1">Show</button>
                <button className="hover:bg-[#303030] text-sm p-2 px-4 flex-1">Renderer</button>
                <button className="hover:bg-[#303030] text-sm p-2 px-4 flex-1">Panels</button>
              </div>
            </div>
            
            {/* 3D Viewport */}
            <div className="w-full h-full flex items-center relative justify-center pt-12">
              <div 
                ref={mountRef} 
                className="border border-[#2b2b2b] overflow-hidden"
                style={{ width: '100%', position: 'absolute', height: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-[#131313] border-l border-[#2b2b2b] px-2">
          {/* Workspaces */}
          <div className="text-gray-100 px-3 py-2 font-bold text-sm flex items-center">
            Workspaces
          </div>
          
          <div className="p-4">
            <div className="w-24 h-24 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Box className="w-12 h-12 text-gray-400" />
            </div>
            
            <div className="text-center text-sm text-gray-400 mb-4">
              Select objects in the scene to view,<br />
              edit and set keyframes on channels<br />
              and attributes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}