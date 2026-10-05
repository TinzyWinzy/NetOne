export const decimal=(value:number|null|undefined,digits=2)=>value==null||!Number.isFinite(value)?'Unavailable':new Intl.NumberFormat('en-US',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(value);
export const percentage=(value:number|null|undefined)=>value==null?'Unavailable':`${decimal(value)}%`;
export const hours=(value:number|null|undefined)=>value==null?'Unavailable':`${decimal(value)} hours`;
