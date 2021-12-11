const fetch = require("node-fetch");
const cheerio = require("cheerio");
const download = require("download");
const fs = require("fs");

async function main() {
  const books = ['479']
  for (const bid of books) {
    await saveBookInfo(bid)
    await saveCapterContent(bid)
    await changeSrc(bid)
    downloadImg(bid);
  };
}
main();

async function downloadImg(bid) {
  let time = logTime();

  const files = fs.readdirSync(String(bid));
  for (const fileName of files) {
    if (fileName.endsWith(".html") && fileName.startsWith("第")) {
      const html = fs.readFileSync(`${bid}/${fileName}`).toString();
      const $ = cheerio.load(html);

      const imgs = Array.from($("img"));
      for (const img of imgs) {
        const url = $(img)
          .attr("onerror")
          .replace(`javascript:this.src='`, "")
          .replace(`';this.onerror = null`, "")
          .trim();
        const name = url.split("/").pop();

        time = logTime(time, fileName + " -> " + url);

        const dist = `${bid}/imgs/${name}`;
        if (!fs.existsSync(`${__dirname}/${bid}/imgs`)) {
          fs.mkdirSync(`${bid}/imgs`);
        }
        if (!fs.existsSync(__dirname + "/" + dist)) {
          // download(url, {extract: true}).pipe(fs.createWriteStream(dist));
          try {
            fs.writeFileSync(
              dist,
              await download(url, {
                extract: true,
              })
            );
          } catch (error) {
            continue;
          }
        }
      }
    }
  }
}

function changeSrc(bid) {
  const files = fs.readdirSync(String(bid));
  for (const name of files) {
    if (name.endsWith(".html") && name.startsWith("第")) {
      const html = fs.readFileSync(`${bid}/${name}`).toString();
      const $ = cheerio.load(html);

      const imgs = Array.from($("img"));
      for (const img of imgs) {
        const src = $(img).attr("src");
        const onerror = $(img).attr("onerror");
        const newSrc = "./imgs/" + src.split("/").pop();
        const newOnerror = `javascript:this.src='${src}';this.onerror = null`;
        $(img).attr("onerror", newOnerror);
        $(img).attr("src", newSrc);
      }

      const content = $("body").html();
      fs.writeFileSync(`${bid}/${name}`, content);
    }
  }
  return;
}

async function saveCapterContent(bid) {
  const string = fs.readFileSync(`${bid}/${bid}.json`).toString();
  const json = JSON.parse(string);
  const host = json.host;
  const capters = json.capters;

  let time = logTime();
  for (const { title, ret } of capters) {
    let t1 = `${bid}/${title.split("话")[0] + "话"}.html`;
    let t2 = `${bid}/${title.split("話")[0] + "話"}.html`;
    const ntitle = t1.length > t2.length ? t2 : t1;
    if (fs.existsSync(__dirname + "/" + ntitle)) {
      console.log( ntitle + ' exists. continue next!')
      continue;
    }

    time = logTime(time, ntitle);
    const html = await fetchHtml(`https://${host}${ret}`);
    const $ = cheerio.load(html);
    Array.from($("#cp_img img")).forEach((img) => {
      $(img).attr("src", $(img).attr("data-original"));
      $(img).css('width', '100%');
    });
    const content = $("#cp_img").html();

    fs.writeFileSync(ntitle, content);
  }
}

async function saveBookInfo(bid) {
  const time0 = logTime();

  const host = "www.5ikanhm.top";
  const url = `https://${host}/book/${bid}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const capters = Array.from($("#detail-list-select a"));
  const name = $(".detail-main-info-title").text();
  const desc = $(".detail-desc").text();

  const time1 = logTime(time0, "加载并解析DOM");

  let obj = {
    bid: bid,
    host: host,
    url: url,
    name: name,
    desc: desc,
    capters: [],
  };
  for (const cap of capters) {
    const $cap = $(cap);
    const title = $cap.text();
    const info = $cap.attr("href");
    const ret = info;
    obj.capters.push({ title, ret });
  }

  // 保留最后一个
  // obj.capters = [obj.capters.pop()]

  const time2 = logTime(time1, "loop DOM & create array");

  if (!fs.existsSync(__dirname + "/" + bid)) {
    fs.mkdirSync(String(bid));
  }
  fs.writeFileSync(`${bid}/${bid}.json`, JSON.stringify(obj, null, 2));

  const time3 = logTime(time2, "write document");
}

async function fetchHtml(url) {
  const userAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";
  const res = await fetch(url, {
    headers: {
      "user-agent": userAgent,
    },
  });
  return res.text();
}

function logTime(from = 0, msg = "") {
  const now = Date.now();
  if (from === 0) {
    console.log("start time: 0");
  } else {
    console.log("spend time: " + (now - from) + " " + msg);
  }
  return now;
}
