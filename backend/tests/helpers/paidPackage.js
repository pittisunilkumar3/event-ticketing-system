// Package eligibility fixture for unrelated integration suites. Never used by the app.
module.exports=async function paidPackage(connection,organizationId,eventCount){
 const [[database]]=await connection.query('SELECT DATABASE() name');
 if(!/^(tf_(gateway|wallet|forms)_test_|ticketflow_test_)\d+_\d+$/.test(database.name||''))throw new Error('Paid package fixtures require a disposable test database.');
 const [pack]=await connection.query("INSERT INTO event_packages(name,event_count,price_paise,active) VALUES ('Integration package',?,100,FALSE)",[eventCount]);
 const id=require('node:crypto').randomUUID();
 await connection.query("INSERT INTO package_purchases(id,organization_id,package_id,package_name,event_count,amount_paise,status,request_key,paid_at) VALUES (?,?,?,'Integration package',?,100,'paid',?,NOW())",[id,organizationId,pack.insertId,eventCount,id]);
 await connection.query("INSERT INTO event_credits(organization_id,amount,kind,reason,reference_key) VALUES (?,?,'purchase','Integration package fixture',?)",[organizationId,eventCount,'purchase:'+id]);
};
