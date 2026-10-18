let checkoutScript;
export function loadCheckout(){
 if(window.Razorpay)return Promise.resolve();
 if(!checkoutScript)checkoutScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=resolve;script.onerror=()=>{checkoutScript=null;script.remove();reject(new Error('Unable to load payment checkout. Please try again.'));};document.head.appendChild(script);});
 return checkoutScript;
}
