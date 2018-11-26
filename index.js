const puppeteer = require('puppeteer');
const R = require('ramda');

(async () => {
  const browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      slowMo: 250 // slow down by 250ms
    });
  const page = await browser.newPage();
  let requests = [];
  // await page.setRequestInterception(true);
  //https://api.bilibili.com/x/v2/reply?callback=jQuery17207958436080292406_1543244048302&jsonp=jsonp&pn=2&type=1&oid=29678074&sort=0&_=1543245958389
  page.on('requestfinished', request => {
    const url = request.url();
    // console.log(url)
    if (url.indexOf('api.bilibili.com/x/v2/reply?callback') != -1){
       requests.push(request);
      //  map.set(url, request); 
    }
  });
  await page.goto('https://www.bilibili.com/bangumi/play/ss24588/?from=search&seid=15802154388770833208', ['load', 'networkidle0']);

  //api.bilibili.com/x/v2/reply?callback
  await page.evaluate(() => {
     document.querySelector('#bangumi_media').scrollIntoView({behavior: "instant", block: "start", inline: "nearest"});
  });

  await page.waitFor(200);
  const eplistHandle = await page.evaluateHandle(async () => {
    debugger;
    let elems = document.querySelectorAll('.episode-list .ep-index'), i = 0, len = elems.length;
    return new Promise((resolve)=>{
      function go(){
        if(i<len){
          let elem = elems[i++];
          elem.scrollIntoView({behavior: "instant", block: "start", inline: "nearest"});
          elem.click();
          setTimeout(go, 2000)
        }else{
          resolve();
        }
      }

      go();
    });
  });

  await Promise.all(requests.map(async (request)=>{
      let text = await request.response().text();
      let json = JSON.parse(text.replace(/^\s*[^\(]+\(|\)\s*$/g, '')) ;
      console.log(json)
  }));

  console.log(map);
  //crawlEPS(eplistHandle);
  await page.screenshot({path: 'example.png'});
//   await page.close();
//   await browser.close();
})();

async function crawlEPS(eplistHandle){
  // for(){

  // }
  const eplsitMap = await eplistHandle.getProperties();
  for(let [i, epHandle] of eplsitMap){
    await page.evaluate((epHandle) => {
        epHandle.click();
    }, epHandle);

    await page.waitFor(200);
    crawlEPComments(epHandle);
  }
}

async function crawlEPComments(epHandle){

  await page.evaluate((epHandle) => {
      return [].slice.call(document.querySelectorAll('.comment-list .text')).map(elem => elem.textContent)
  }, epHandle);
}