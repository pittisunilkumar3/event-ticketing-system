import {formatCurrency} from '../utils/format';
import './tax-breakdown.css';
export function readTaxSnapshot(value){if(!value)return null;try{return typeof value==='string'?JSON.parse(value):value;}catch{return null;}}
export default function TaxBreakdown({value,currency='INR'}){
 const tax=readTaxSnapshot(value);if(!tax?.profiles?.length)return null;
 const modes=new Set(tax.profiles.map(p=>p.price_mode));
 return <section className="tax-breakdown" aria-label="Tax breakdown"><p>{modes.size>1?'Tax treatment varies by ticket type.':modes.has('inclusive')?'Tax is included in these ticket prices.':'Tax is added to these ticket prices.'}</p><div><span>Amount excluding tax</span><strong>{formatCurrency(tax.taxable_minor/100,currency)}</strong></div>{tax.components.map((c,index)=><div key={index}><span>{c.name} ({Number(c.rate_bps)/100}%)<small>{c.included?'Included in price':'Added to price'}</small></span><strong>{formatCurrency(c.amount_minor/100,currency)}</strong></div>)}<div><span>Total tax</span><strong>{formatCurrency(tax.tax_minor/100,currency)}</strong></div><div><span>Amount including tax</span><strong>{formatCurrency(tax.total_minor/100,currency)}</strong></div>{[...new Set(tax.profiles.filter(p=>p.gstin).map(p=>(p.legal_name?p.legal_name+' · ':'')+'GSTIN: '+p.gstin))].map(value=><small key={value} className="tax-business">{value}</small>)}</section>;
}
