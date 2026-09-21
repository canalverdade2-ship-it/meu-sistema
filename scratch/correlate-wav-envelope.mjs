import fs from 'node:fs';

function envelope(file, blockMs=50) {
  const b=fs.readFileSync(file); let pos=12,channels,rate,bits,start,size;
  while(pos+8<=b.length){const id=b.toString('ascii',pos,pos+4),n=b.readUInt32LE(pos+4);if(id==='fmt '){channels=b.readUInt16LE(pos+10);rate=b.readUInt32LE(pos+12);bits=b.readUInt16LE(pos+22)}if(id==='data'){start=pos+8;size=Math.min(n,b.length-start);break}pos+=8+n+(n&1)}
  const block=Math.round(rate*blockMs/1000), bytes=channels*3,frames=Math.floor(size/bytes),out=[];
  for(let base=0;base<frames;base+=block){let sum=0,n=0,end=Math.min(frames,base+block);for(let f=base;f<end;f++){for(let c=0;c<channels;c++){let o=start+f*bytes+c*3,v=b[o]|(b[o+1]<<8)|(b[o+2]<<16);if(v&0x800000)v|=0xff000000;const x=v/8388608;sum+=x*x;n++}}out.push(Math.sqrt(sum/n))}return {out,blockMs};
}
const source=envelope(process.argv[2]),target=envelope(process.argv[3]);let best={r:-2,offset:0};
for(let off=0;off+target.out.length<=source.out.length;off++){let sx=0,sy=0,sxx=0,syy=0,sxy=0,n=target.out.length;for(let i=0;i<n;i++){const x=source.out[off+i],y=target.out[i];sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y}const den=Math.sqrt((n*sxx-sx*sx)*(n*syy-sy*sy));const r=den?(n*sxy-sx*sy)/den:-1;if(r>best.r)best={r,offset:off};}
console.log(JSON.stringify({...best,offsetSeconds:best.offset*source.blockMs/1000,sourceBaseSeconds:Number(process.argv[4]||0),absoluteSourceSeconds:Number(process.argv[4]||0)+best.offset*source.blockMs/1000},null,2));
