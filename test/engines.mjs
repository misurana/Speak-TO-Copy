// Three fake engines reproducing the three real behaviours of event.results.
export const FAKE = `
window.__f = { inst: [], starts: 0, mode: 'cumulative' };
function mkres(arr){ var o = arr.map(function(c){ return {0:{transcript:c.t}, isFinal:c.f, length:1}; }); o.length = arr.length; return o; }
class F {
  constructor(){ this.lang='en'; this.continuous=false; this.interimResults=false; window.__f.inst.push(this); this._s=false; }
  start(){ if(this._s){ var e=new Error('x'); e.name='InvalidStateError'; throw e; }
           this._s=true; window.__f.starts++; var self=this; setTimeout(function(){ self.onstart && self.onstart({}); },3); }
  stop(){ if(!this._s) return; this._s=false; var self=this; setTimeout(function(){ self.onend && self.onend({}); },3); }
  abort(){ this._s=false; }
  fire(arr){ this.onresult && this.onresult({ results: mkres(arr), resultIndex: 0 }); }
  err(n){ this.onerror && this.onerror({error:n}); }
  end(){ this._s=false; this.onend && this.onend({}); }
}
window.SpeechRecognition = F;
delete window.webkitSpeechRecognition;
window.__cur = function(){ return window.__f.inst[window.__f.inst.length-1]; };
`;
