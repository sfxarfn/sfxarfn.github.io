// Original lightweight pressure-pulse model. No recordings or third-party code.
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const finite = (x,d) => Number.isFinite(x) ? x : d;

class Pipe {
  constructor(rate, seconds, reflection) {
    this.buffer=new Float64Array(Math.ceil(rate*seconds)+2);
    this.delay=rate*seconds;this.pos=0;this.loss=0;this.reflection=reflection;
  }
  tick(x) {
    const b=this.buffer,n=b.length;
    let p=this.pos-this.delay;if(p<0)p+=n;
    const k=Math.floor(p),f=p-k;
    const returning=b[k]*(1-f)+b[(k+1)%n]*f;
    this.loss += .32*(returning-this.loss);
    b[this.pos]=x+this.loss*this.reflection;
    this.pos=(this.pos+1)%n;
    return x+this.loss*.45;
  }
}

export class V6PulseDSP {
  constructor(sampleRate=48000, seed=1977) {
    this.rate=clamp(finite(sampleRate,48000),8000,192000);this.internalRate=this.rate*2;
    this.seed=seed>>>0;this.phase=0;this.cylinder=0;this.events=0;
    this.slow=new Float64Array(6);this.fast=new Float64Array(6);
    this.weights=[1.022,.983,1.008,.977,1.019,.991];
    this.order=[0,3,1,4,2,5];this.cycleVariation=1;
    this.left=new Pipe(this.internalRate,.00073,-.38);
    this.right=new Pipe(this.internalRate,.00087,-.36);
    this.collector=new Pipe(this.internalRate,.00215,-.27);
    this.intake=new Pipe(this.internalRate,.00155,-.32);
    this.rpm=3800;this.load=0;this.burp=0;this.view=1;
    this.dc=0;this.bodyDC=0;this.low=0;this.low2=0;this.body=0;
    this.dcK=1-Math.exp(-2*Math.PI*35/this.internalRate);
    this.bodyK=1-Math.exp(-2*Math.PI*720/this.internalRate);
    this.fastDecay=Math.exp(-1/(this.internalRate*.00009));
  }
  random() {
    this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;
    return this.seed/4294967296*2-1;
  }
  render(main,bass,control={}) {
    const n=Math.min(main.length,bass.length);if(!n)return;
    const targetRpm=clamp(finite(control.rpm,3800),300,15000);
    const targetLoad=clamp(finite(control.load,0),0,1);
    const targetBurp=clamp(finite(control.burp,0),0,1);
    const targetView=clamp(finite(control.cockpit,1),0,1);
    const dr=(targetRpm-this.rpm)/n,dl=(targetLoad-this.load)/n;
    const db=(targetBurp-this.burp)/n,dv=(targetView-this.view)/n;
    const decay=Math.exp(-1/(this.internalRate*(.00050+.00020*(1-targetLoad)+targetBurp*.00012)));
    const cutoff=4200+targetLoad*1400-targetView*650;
    const lowK=1-Math.exp(-2*Math.PI*cutoff/this.internalRate);
    for(let i=0;i<n;i++) {
      this.rpm+=dr;this.load+=dl;this.burp+=db;this.view+=dv;
      let out=0,body=0;
      const firing=this.rpm/20;
      const compensation=clamp(Math.sqrt(380/firing),.78,1.65);
      const projection=1+clamp((this.rpm-6500)/6500,0,1)*.9;
      for(let sub=0;sub<2;sub++) {
        this.phase+=firing/this.internalRate;
        if(this.phase>=1) {
          this.phase-=1;
          if(this.cylinder===0)this.cycleVariation=1+this.random()*(.012-this.load*.007);
          const c=this.order[this.cylinder];
          const amplitude=this.weights[c]*this.cycleVariation*(1+this.random()*.004);
          this.slow[c]+=amplitude;this.fast[c]+=amplitude;
          this.cylinder=(this.cylinder+1)%6;this.events++;
        }
        let a=0,b=0;
        for(let c=0;c<6;c++) {
          this.slow[c]*=decay;this.fast[c]*=this.fastDecay;
          const pulse=this.slow[c]-this.fast[c];
          if(c<3)a+=pulse;else b+=pulse;
        }
        const l=this.left.tick(a),r=this.right.tick(b);
        const exhaust=this.collector.tick(l+r);
        const inlet=this.intake.tick((a+b)*.55);
        const pressure=exhaust*(.9-this.view*.06)+inlet*(.06+this.view*.09);
        this.dc+=this.dcK*(pressure-this.dc);
        const ac=pressure-this.dc;
        this.low+=lowK*(ac-this.low);this.low2+=lowK*(this.low-this.low2);
        const bankPressure=l-r;
        this.bodyDC+=this.dcK*(bankPressure-this.bodyDC);
        this.body+=this.bodyK*(bankPressure-this.bodyDC-this.body);
        out+=Math.tanh(this.low2*(1.8+this.load*.35))*.53*compensation*projection;
        body+=this.body*.55*compensation;
      }
      main[i]=clamp(out*.5,-.8,.8);
      bass[i]=clamp(body*.5,-.45,.45);
    }
  }
}
