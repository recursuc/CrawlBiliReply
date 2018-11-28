const puppeteer = require("puppeteer");
const fs = require("fs");
const R = require("ramda");

async function crawlPage(browser, epIndex) {
  const page = await browser.newPage();
  let oid = "";
  // await page.setRequestInterception(true);
  //https://api.bilibili.com/x/v2/reply?callback=jQuery17207958436080292406_1543244048302&jsonp=jsonp&pn=2&type=1&oid=29678074&sort=0&_=1543245958389
  page.on("request", async request => {
    //requestfinished
    const url = request.url();
    // console.log(epIndex,'---', url.substr(0, 150))
    if (url.indexOf("api.bilibili.com/x/v2/reply?callback") != -1) {
      oid = new URL(url).searchParams.get("oid");
      console.log(epIndex, "---", oid);
    }
  });

  await page.goto(
    "https://www.bilibili.com/bangumi/play/ss24588/?from=search&seid=15802154388770833208",
    ["load", "networkidle0"]
  );

  let epItem = await page.evaluate(async epIndex => {
    const episode = document.querySelector(".episode-list");
    episode.scrollIntoView({
      behavior: "instant",
      block: "start",
      inline: "nearest"
    });

    const epItem = episode.querySelectorAll(".ep-index")[epIndex];
    epItem.click();

    return {
      index: epItem.textContent,
      title: epItem.nextElementSibling.textContent
    };
  }, epIndex);
  await page.waitFor(1000);

  let res = await page.evaluate(async oid => {
    const res1 = await $.ajax({
      url: "//api.bilibili.com/x/v2/reply",
      data: {
        jsonp: "jsonp",
        pn: 1,
        type: 1,
        oid: oid,
        sort: 0
      },
      dataType: "jsonp"
    });

    if (!res1.data || !res1.data.page) {
      return [];
    }

    let { count, size } = res1.data.page,
      total = Math.ceil(count / size),
      i = 2;

    return await new Promise((resolve, reject) => {
      function run(todos, size) {
        let success = {},
          j = todos[0].pn;

        function next() {
          if (!todos.length) {
            resolve([]);

            return;
          }
          const todo = todos.shift();
          let pn = todo.pn;

          todo.retry++;
          console.log(pn + " task start");
          $.ajax({
            url: "//api.bilibili.com/x/v2/reply",
            data: {
              jsonp: "jsonp",
              pn: pn,
              type: 1,
              oid: oid,
              sort: 0
            },
            dataType: "jsonp"
          })
            .done(res => {
              if (res.data && res.data.page) {
                //记录已经完成的
                todo.data = res.data.page;
                success[pn] = todo;
                consume(success);

                setTimeout(next, 20);
              }
            })
            .fail(() => {
              if (todo.retry < 3) {
                todos.unshift(todo);
              } else {
                todo.data = null;
                success[pn] = todo;
                consume(success);
              }

              setTimeout(next, 20);
            });
        }

        //检测是否为连续到达  然后消费
        function consume(success) {
          let todo;
          while ((todo = success[j])) {
            if (todo) {
              //todo: 处理pn页
              console.log("处理:", todo.pn);
              delete success[j];
            }

            j++;
          }
        }

        //维持10个请求
        for (let i = 0; i <= size; i++) {
          next();
        }
      }

      //初始化任务数量
      let todos = [];
      for (i = 2; i <= total; i++) {
        todos.push({ pn: i, retry: 0, data: null });
      }

      run(todos, 6);
    });
  }, oid);

  fs.writeFileSync(epItem.index + epItem.title + ".json", JSON.stringify(res));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    slowMo: 250 // slow down by 250ms
  });

  const page = await browser.newPage();
  await page.goto(
    "https://www.bilibili.com/bangumi/play/ss24588/?from=search&seid=15802154388770833208",
    ["load", "networkidle0"]
  );

  const length = await page.evaluateHandle(async () => {
    const episode = document.querySelector(".episode-list");
    episode.scrollIntoView({
      behavior: "instant",
      block: "start",
      inline: "nearest"
    });

    return episode.querySelectorAll(".episode-list .ep-index").length;
  });

  //console.log(elemsHanle.getProperties().keys());
  await Promise.all(
    [1].map(async (v, i) => {
      await crawlPage(browser, i);
    })
  );

  await page.waitFor(200);
  return;
})();


function close(){
  const eplistHandle = await page.evaluateHandle(async () => {
    debugger;
    let elems = document.querySelectorAll(".episode-list .ep-index"),
      i = 0,
      len = elems.length;
    return new Promise(resolve => {
      function go() {
        if (i < len) {
          let elem = elems[i++];
          elem.scrollIntoView({
            behavior: "instant",
            block: "start",
            inline: "nearest"
          });
          elem.click();
          setTimeout(go, 2000);
        } else {
          resolve();
        }
      }

      go();
    });
  });

  await Promise.all(
    requests.map(async request => {
      let text = await request.response().text();
      let json = JSON.parse(text.replace(/^\s*[^\(]+\(|\)\s*$/g, ""));
      console.log(json);
    })
  );

  console.log(map);
  crawlEPS(eplistHandle);
  await page.screenshot({ path: "example.png" });
  await page.close();
  await browser.close();
}

async function crawlEPS(eplistHandle) {
  const eplsitMap = await eplistHandle.getProperties();
  for (let [i, epHandle] of eplsitMap) {
    await page.evaluate(epHandle => {
      epHandle.click();
    }, epHandle);

    await page.waitFor(200);
    crawlEPComments(epHandle);
  }
}

async function crawlEPComments(epHandle) {
  await page.evaluate(epHandle => {
    return [].slice
      .call(document.querySelectorAll(".comment-list .text"))
      .map(elem => elem.textContent);
  }, epHandle);
}
