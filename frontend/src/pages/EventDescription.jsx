/** Format the organizer's saved plain text without interpreting it as HTML. */
export function descriptionSections(value='') {
  const intro=[],passes=[];
  let current=intro;
  for(const raw of value.split(/\r?\n/)) {
    const line=raw.trim();
    if(!line)continue;
    const heading=line.match(/^\d+\.\s+(.+?)\s+[-–—]\s+(₹[\d,.]+)$/);
    if(heading){const pass={title:heading[1],price:heading[2],lines:[]};passes.push(pass);current=pass.lines;}
    else current.push(line);
  }
  return {intro,passes};
}
function TextBlocks({lines}) {
  const blocks=[];
  for(const line of lines){
    const bullet=line.match(/^[•●▪]\s*(.+)$/);
    if(bullet){if(blocks.at(-1)?.type!=='list')blocks.push({type:'list',items:[]});blocks.at(-1).items.push(bullet[1]);}
    else blocks.push({type:line.endsWith(':')?'heading':'paragraph',text:line});
  }
  return blocks.map((block,i)=>block.type==='list'?<ul key={i}>{block.items.map((item,j)=><li key={j}>{item}</li>)}</ul>:block.type==='heading'?<h4 key={i}>{block.text.replace(/:$/,'')}</h4>:<p key={i}>{block.text}</p>);
}
export default function EventDescription({description}) {
  const {intro,passes}=descriptionSections(description||'The organizer will share more details about this experience soon.');
  return <div className="experience-description">
    {intro.length>0&&<div className="experience-intro"><TextBlocks lines={intro}/></div>}
    {passes.length>0&&<div className="experience-pass-grid">{passes.map((pass,i)=>{
      const dinner=pass.lines.findIndex(line=>/^VIP DINNER\s*[–—-]/i.test(line));
      return <article className={'experience-card'+(dinner>=0?' experience-card-featured':'')} key={i}>
        <header><div><span className="experience-pass-number">PASS {String(i+1).padStart(2,'0')}</span><h3>{pass.title}</h3></div><strong className="experience-pass-price">{pass.price}</strong></header>
        <div className="experience-card-content"><div><TextBlocks lines={dinner>=0?pass.lines.slice(0,dinner):pass.lines}/></div>
        {dinner>=0&&<aside className="experience-dinner"><span className="experience-dinner-label">INCLUDED WITH THIS PASS</span><h4>{pass.lines[dinner]}</h4><TextBlocks lines={pass.lines.slice(dinner+1)}/></aside>}</div>
      </article>;
    })}</div>}
  </div>;
}
