import {V6PulseDSP} from './v6-pulse-dsp-r7.js';

class V6PulseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {name:'rpm',defaultValue:3800,minValue:300,maxValue:15000,automationRate:'k-rate'},
      {name:'load',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'},
      {name:'burp',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'},
      {name:'cockpit',defaultValue:1,minValue:0,maxValue:1,automationRate:'k-rate'}
    ];
  }
  constructor() {super();this.dsp=new V6PulseDSP(sampleRate);this.control={};}
  process(inputs,outputs,parameters) {
    const a=outputs[0]?.[0],b=outputs[1]?.[0];
    if(a&&b){
      for(const key of ['rpm','load','burp','cockpit'])this.control[key]=parameters[key][0];
      this.dsp.render(a,b,this.control);
    }
    return true;
  }
}
registerProcessor('ps-v6-pulses-r7',V6PulseProcessor);
