import type { Site, Period } from './portfolio.js';
export interface GrowthEvidence {value:number|null;status:'COMPARABLE'|'MISSING'|'ZERO_BASE'|'STALE'|'INCOMPARABLE';definition:string;currentPeriod:string;priorPeriod:string;currentGB:number|null;priorGB:number|null;sources:string[]}
export function trafficGrowth(site:Site,period:Period):GrowthEvidence {
 const [y,m]=period.split('-').map(Number),priorPeriod=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);
 const current=site.observations.find(x=>x.period===period),prior=site.observations.find(x=>x.period===priorPeriod)||site.networkHistory?.find(x=>x.period===priorPeriod);
 const result:GrowthEvidence={value:null,status:'MISSING',definition:'Month-on-month aggregate traffic growth: (current GB / prior calendar-month GB − 1) × 100. Same synthetic asset, scope and source family; no forecast.',currentPeriod:period,priorPeriod,currentGB:current?.trafficGB??null,priorGB:prior?.trafficGB??null,sources:[current?.sourceRef,prior?.sourceRef].filter((x):x is string=>!!x)};
 if(!current||!prior||result.currentGB===null||result.priorGB===null)return result;
 if(current.quality==='STALE'||prior.quality==='STALE')return {...result,status:'STALE'};
 if(current.quality!=='COMPLETE'||prior.quality!=='COMPLETE'||result.currentGB<0||result.priorGB<0||!Number.isFinite(result.currentGB)||!Number.isFinite(result.priorGB))return {...result,status:'INCOMPARABLE'};
 const family=(ref?:string)=>ref?.split('/')[0];if(!family(current.sourceRef)||family(current.sourceRef)!==family(prior.sourceRef))return {...result,status:'INCOMPARABLE'};
 if(result.priorGB===0)return {...result,status:'ZERO_BASE'};
 return {...result,value:(result.currentGB/result.priorGB-1)*100,status:'COMPARABLE'};
}
