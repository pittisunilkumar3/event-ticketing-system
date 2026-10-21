const crypto=require('crypto');
const revision=row=>crypto.createHash('sha256').update(JSON.stringify([row.name,Boolean(row.active),row.config_json,row.updated_at])).digest('hex');
function check(existing,input){
 if(existing.kind!=='ticket')return;
 const matches=input.revision?input.revision===existing.revision:input.updated_at&&String(input.updated_at)===String(existing.updated_at);
 if(!matches)throw Object.assign(new Error('This design was saved in another tab. Reopen the latest design before making changes; your current draft has not been saved.'),{statusCode:409});
}
module.exports={revision,check};
