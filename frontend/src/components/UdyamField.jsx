import {formatCurrency} from '../utils/format';
export default function UdyamField({id,value={},onChange,onUpload,disabled=false,couponApplied=false,policy,discountMinor,ticketPrice,required=false}) {
  const amount=formatCurrency(Math.min(Number(ticketPrice),Number(discountMinor??policy?.per_ticket_minor??10000)/100));
  return <div className="attendee-udyam">
    <label htmlFor={id}>Udyam Registration Number <span>({couponApplied?'disabled':required?'required':'optional'})</span></label>
    <div className="attendee-udyam-controls">
      <input id={id} name={id} value={value.number||''} placeholder={couponApplied?'Disabled while coupon is applied':policy?.placeholder||'UDYAM-TS-09-02.......'} maxLength={19} autoComplete="off" spellCheck={false} required={required&&!couponApplied} aria-describedby={id+'_help'} aria-invalid={!couponApplied&&Boolean(value.error)} disabled={disabled||couponApplied} onChange={e=>onChange(e.target.value)}/>
      {value.number&&<button type="button" disabled={disabled||couponApplied} onClick={()=>onChange('')}>Clear</button>}
    </div>
    <p id={id+'_help'}>{couponApplied?'Udyam is disabled while a coupon is applied. Only the coupon discount will be used.':`Enter a correctly formatted number to save ${amount} on this ticket only. Each number can be used once for this event. Registration status is not checked.`}</p>
    {!couponApplied&&value.error&&<p role="alert">{value.error}</p>}
    {!couponApplied&&value.number&&policy?.certificate_required&&<div className="udyam-certificate">
      <label htmlFor={id+'_certificate'}>Udyam certificate <span>(required)</span></label>
      <input key={value.number} id={id+'_certificate'} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required disabled={disabled||couponApplied} aria-describedby={id+'_certificate_help'} aria-invalid={Boolean(value.fileError)} onChange={e=>onUpload(e.target.files[0]||null)}/>
      <p id={id+'_certificate_help'}>Upload the certificate for this Udyam Registration Number. PDF, PNG, JPEG or WebP · Up to 2 MB.</p>
      {value.fileError&&<p role="alert">{value.fileError}</p>}
    </div>}
    {!couponApplied&&value.status==='accepted'&&<p className="udyam-verified" role="status">{policy?.certificate_required&&!value.certificate?'Upload your certificate to continue with the discount.':`Number format accepted · ${amount} discount requested for this ticket.`}</p>}
  </div>;
}
