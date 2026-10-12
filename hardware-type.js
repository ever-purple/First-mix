import * as THREE from './node_modules/three/build/three.module.js';

// Parse the local typeface outlines directly into geometry. No text bitmap, UV
// scaling or mipmap filtering is involved in the faceplate lettering.
export const hardwareTypeface=fetch(new URL('./assets/helvetiker_regular.typeface.json',import.meta.url))
  .then(response=>{if(!response.ok)throw new Error('Hardware typeface unavailable');return response.json();});

export function hardwareTextGeometry(font,text,height){
  const shapes=[];let advance=0;
  for(const character of text.toUpperCase()){
    const glyph=font.glyphs[character]||font.glyphs['?'];if(!glyph)continue;
    const path=new THREE.ShapePath();const tokens=glyph.o?.trim().split(/\s+/)||[];let cursor=0;
    const point=()=>[Number(tokens[cursor++])+advance,Number(tokens[cursor++])];
    while(cursor<tokens.length){
      const command=tokens[cursor++];
      if(command==='m'){path.moveTo(...point());}
      else if(command==='l'){path.lineTo(...point());}
      else if(command==='q'){const end=point(),control=point();path.quadraticCurveTo(...control,...end);}
      else if(command==='b'){const end=point(),first=point(),second=point();path.bezierCurveTo(...first,...second,...end);}
      else throw new Error('Unknown typeface outline command');
    }
    shapes.push(...path.toShapes());advance+=glyph.ha;
  }
  const geometry=new THREE.ShapeGeometry(shapes,8);geometry.computeBoundingBox();
  const bounds=geometry.boundingBox;const factor=height/Math.max(1,bounds.max.y-bounds.min.y);
  geometry.translate(-(bounds.max.x+bounds.min.x)/2,-(bounds.max.y+bounds.min.y)/2,0);geometry.scale(factor,factor,1);return geometry;
}
