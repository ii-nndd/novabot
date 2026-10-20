// لوحة التحكم الكاملة: /dashboard
// 🌐 لكل سيرفر لوحته: تسجيل دخول بحساب ديسكورد، وينسمح لللي **أعطاه صلاحية** فقط
// (قائمة مسموحين لكل سيرفر عبر access.js) + ارثر وإيدا يدخلون كل السيرفرات.
// المتغيرات المطلوبة: DISCORD_CLIENT_ID و DISCORD_CLIENT_SECRET و SESSION_SECRET
const crypto = require('crypto');
const path = require('path');
const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const store = require('./store');
const welcome = require('./welcome');
const tickets = require('./tickets');
const jail = require('./jail');
const trap = require('./trap');
const guard = require('./guard');
const presence = require('./presence');
const hub = require('./hub');
const points = require('./points');
const levels = require('./levels');
const botcontrol = require('./botcontrol');
const colors = require('./colors');
const replies = require('./replies');
const economy = require('./economy');
const giveaway = require('./giveaway');
const admin = require('./admin');
const access = require('./access');
const reactions = require('./reactions');
const replies2 = require('./replies2');

// الرابط العام: يُقرأ وقت الطلب (مو وقت الإقلاع) لأن النفق التلقائي يضبطه بعد الإقلاع
const BASE = () => (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://divelbot.onrender.com').replace(/\/+$/, '');
const SECRET = process.env.SESSION_SECRET;
const CID = process.env.DISCORD_CLIENT_ID;
const CSEC = process.env.DISCORD_CLIENT_SECRET;
const WEEK = 7 * 24 * 3600 * 1000;

const hmac = (b) => crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
const sign = (p) => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + hmac(b); };
function verify(t) {
    if (!t || !SECRET) return null;
    const [b, h] = t.split('.');
    if (!b || !h) return null;
    const e = hmac(b);
    if (h.length !== e.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(e))) return null;
    try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > Date.now() ? p : null; }
    catch { return null; }
}
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';')
    .map(c => c.trim().split(/=(.*)/s).slice(0, 2)).filter(x => x[0]));
const setCookie = (res, n, v, age) =>
    res.append('Set-Cookie', `${n}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`);

const clean = (s) => String(s || '').trim().slice(0, 100);
const hex = (s) => (/^#[0-9a-fA-F]{6}$/.test(s) ? s : null);
// رقم إصدار اللوحة: يظهر بصفحة «نظرة عامة» وبمسار /dashboard/api/ping — يفيدنا نعرف النسخة الشغالة وهل الصفحة قديمة عند المتصفح
const BUILD = '2026-10-20.7';

const PAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>لوحة نوفا الملكية</title><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#0f0e14"><link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/icon-192.png"><meta name="mobile-web-app-capable" content="yes">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
html{scroll-behavior:smooth}
::selection{background:rgba(224,35,47,.35)}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-track{background:#0b0a11}
::-webkit-scrollbar-thumb{background:linear-gradient(#312e42,#1c1b26);border-radius:20px;border:2px solid #0b0a11}
::-webkit-scrollbar-thumb:hover{background:linear-gradient(#b3121e,#7d0d16)}
body{margin:0;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;background:#07060b;color:#eceaf3;
  background-image:
    radial-gradient(1.5px 1.5px at 20px 30px,rgba(255,255,255,.5),transparent),
    radial-gradient(1.5px 1.5px at 90px 80px,rgba(255,255,255,.34),transparent),
    radial-gradient(1px 1px at 160px 40px,rgba(255,255,255,.44),transparent),
    radial-gradient(1px 1px at 230px 120px,rgba(255,220,190,.4),transparent),
    radial-gradient(1.5px 1.5px at 300px 20px,rgba(255,255,255,.3),transparent),
    radial-gradient(1px 1px at 60px 160px,rgba(255,255,255,.34),transparent),
    radial-gradient(1.5px 1.5px at 340px 180px,rgba(255,200,170,.35),transparent),
    radial-gradient(1200px 640px at 88% -14%,rgba(190,20,36,.24),transparent 62%),
    radial-gradient(900px 520px at -10% 106%,rgba(232,176,75,.10),transparent 60%),
    radial-gradient(760px 460px at 45% 45%,rgba(110,30,150,.10),transparent 72%);
  background-repeat:repeat,repeat,repeat,repeat,repeat,repeat,repeat,no-repeat,no-repeat,no-repeat;
  background-size:380px 220px,380px 220px,380px 220px,380px 220px,380px 220px,380px 220px,380px 220px,auto,auto,auto;
  background-attachment:fixed;-webkit-font-smoothing:antialiased}
#bg{position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
.iconbtn{width:40px;height:40px;min-height:40px;padding:0;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);color:#eceaf3;transition:background .16s,opacity .25s}
.iconbtn:hover{background:rgba(255,255,255,.13)}
.app{display:flex;min-height:100vh}
.wrap{flex:1;min-width:0;max-width:1140px;display:flex;flex-direction:column}
.sb{width:246px;padding:16px 12px 26px;flex-shrink:0;display:flex;flex-direction:column;gap:3px;position:sticky;top:0;height:100vh;overflow-y:auto;
  background:linear-gradient(180deg,rgba(23,21,31,.94),rgba(13,12,19,.94));backdrop-filter:blur(16px);border-left:1px solid rgba(255,255,255,.06)}
.logo{display:flex;align-items:center;gap:9px;font-size:19px;font-weight:700;margin:6px 8px 12px;letter-spacing:.3px}
.logo span{background:linear-gradient(135deg,#ffd7ad,#f0566a 55%,#b3121e);-webkit-background-clip:text;background-clip:text;color:transparent}
.navlab{color:#6d6980;font-size:10.5px;font-weight:700;letter-spacing:.09em;margin:15px 11px 5px}
.nav{padding:11px 13px;border-radius:12px;color:#a7a3b6;font-size:14.5px;cursor:pointer;border:0;background:none;text-align:right;font:inherit;
  display:flex;align-items:center;gap:11px;width:100%;position:relative;text-decoration:none;transition:background .18s,color .18s,transform .12s}
.nav .ic{width:22px;text-align:center;font-size:16px;flex-shrink:0}
.nav:hover{background:rgba(255,255,255,.05);color:#eae7f1}
.nav.on{background:linear-gradient(90deg,rgba(179,18,30,.30),rgba(179,18,30,.04));color:#ff8d99;font-weight:600}
.nav.on:before{content:"";position:absolute;inset-inline-end:0;top:16%;bottom:16%;width:3px;border-radius:3px;background:linear-gradient(#ff5c6c,#8c0f1a);box-shadow:0 0 12px rgba(224,35,47,.85)}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 26px;
  background:rgba(9,8,14,.70);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.06)}
.page{padding:24px 26px 56px;animation:up .3s ease both}
@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.main{flex:1;padding:26px;max-width:960px}
h1{position:relative;margin:0 0 16px;font-size:25px;letter-spacing:-.3px;padding-bottom:11px}
h1:after{content:"";position:absolute;bottom:0;inset-inline-start:0;width:62px;height:3px;border-radius:3px;background:linear-gradient(90deg,#e0232f,#e8b04b);box-shadow:0 0 14px rgba(224,35,47,.55)}
.mut{color:#948fa4;font-size:13.5px;line-height:1.95}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
input,select,textarea{background:#0d0c14;color:#eceaf3;border:1px solid #322f45;border-radius:12px;padding:11px 13px;font:inherit;min-height:44px;transition:border-color .16s,box-shadow .16s}
input:focus,select:focus,textarea:focus{outline:none;border-color:#c6152a;box-shadow:0 0 0 3px rgba(198,21,42,.16)}
textarea{width:100%;min-height:130px;line-height:1.9}input[type=color]{padding:3px;width:48px}
button.btn,button.b2,button.dn,a.btn{border:0;border-radius:12px;padding:10px 17px;font:inherit;cursor:pointer;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:filter .15s,transform .1s,box-shadow .15s}
button.btn:hover,button.b2:hover,button.dn:hover,a.btn:hover{filter:brightness(1.13)}
button.btn:active,button.b2:active,button.dn:active,a.btn:active{transform:scale(.975)}
.btn{background:linear-gradient(135deg,#e0232f,#960f1c);color:#fff;font-weight:700;box-shadow:0 6px 18px rgba(179,18,30,.38)}
.b2{background:rgba(255,255,255,.055);color:#eceaf3;border:1px solid rgba(255,255,255,.10)!important}
.dn{background:rgba(224,35,47,.10);color:#ff9aa5;border:1px solid rgba(224,35,47,.42)!important}
.card{position:relative;background:linear-gradient(165deg,rgba(36,32,50,.92),rgba(18,17,25,.95) 62%,rgba(13,12,19,.97));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:18px;margin-bottom:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 20px 44px -14px rgba(0,0,0,.72);transition:transform .2s,border-color .2s,box-shadow .2s}
.card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 26px 52px -14px rgba(0,0,0,.8)}
.card:before{content:"";position:absolute;top:-70px;inset-inline-end:-70px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(224,35,47,.16),transparent 70%);pointer-events:none}
.card.red{border-color:rgba(224,35,47,.32)}
.card.red:before{background:radial-gradient(circle,rgba(224,35,47,.26),transparent 70%)}
.card>*{position:relative}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stats .card{text-align:center}
.big{font-size:31px;font-weight:700;letter-spacing:-1px;background:linear-gradient(135deg,#ffc79b,#f0566a 70%,#c6152a);-webkit-background-clip:text;background-clip:text;color:transparent}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.kv{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:#cfcadb;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:5px 10px;direction:ltr;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.uchip{display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:5px 13px 5px 6px}
.gsel{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:#eee;border-radius:999px;padding:7px 12px;font-family:inherit;font-size:13px;max-width:190px;cursor:pointer}
.gsel option{background:#16141f;color:#eee}
.gp{cursor:pointer;width:100%}
.uav{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(135deg,#e0232f,#6d0a13);box-shadow:0 3px 10px rgba(179,18,30,.45)}
.unm{font-size:13.5px;font-weight:600}
.rgrid{display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start}
.rside{padding:14px;max-height:72vh;overflow:auto}
.rlist{display:flex;flex-direction:column;gap:4px;margin-top:10px}
.ritem{display:flex;align-items:center;gap:8px;width:100%;text-align:right;background:none;border:0;color:#b6b2c4;font:inherit;font-size:13.5px;padding:9px 11px;border-radius:10px;cursor:pointer;transition:background .15s,color .15s}
.ritem:hover{background:rgba(255,255,255,.05);color:#fff}
.ritem.on{background:linear-gradient(90deg,rgba(179,18,30,.30),rgba(179,18,30,.05));color:#ff8d99;font-weight:600}
.ritem .rn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ritem .rc{font-size:11.5px;color:#7d788e;flex-shrink:0}
@media(max-width:900px){.rgrid{grid-template-columns:1fr}.rside{max-height:none}.grid2{grid-template-columns:1fr}.wrap{max-width:none}}
.hero{display:flex;align-items:center;gap:15px;margin-bottom:18px;flex-wrap:wrap;padding:20px;border-radius:20px;
  background:linear-gradient(135deg,rgba(179,18,30,.20),rgba(28,26,38,.85) 45%,rgba(17,16,24,.92));border:1px solid rgba(255,255,255,.08);box-shadow:0 16px 44px rgba(0,0,0,.45)}
.hero .hlogo{width:56px;height:56px;border-radius:17px;display:flex;align-items:center;justify-content:center;font-size:27px;flex-shrink:0;background:linear-gradient(150deg,#e0232f,#5d0710);box-shadow:0 12px 30px rgba(179,18,30,.5),inset 0 0 0 1px rgba(255,255,255,.10)}
.hero h1{margin:0;font-size:24px}
.hero .sub{color:#a09bae;font-size:12.5px;margin-top:4px}
.pill{display:flex;align-items:center;gap:9px;padding:8px 15px;border-radius:999px;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:#c9c5d6;white-space:nowrap}
.pill.on{background:rgba(31,157,85,.13);border-color:rgba(31,157,85,.5);color:#84e8ab}
.pill.off{background:rgba(155,32,32,.16);border-color:rgba(155,32,32,.55);color:#ff9aa5}
.pdot{width:9px;height:9px;border-radius:50%;background:currentColor;animation:npulse 1.9s infinite;flex-shrink:0}
@keyframes npulse{0%{box-shadow:0 0 0 0 rgba(127,224,165,.65)}70%{box-shadow:0 0 0 10px rgba(127,224,165,0)}100%{box-shadow:0 0 0 0 rgba(127,224,165,0)}}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:14px;margin-bottom:16px}
.tile{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012));border:1px solid rgba(255,255,255,.08);border-radius:17px;padding:16px 18px;transition:transform .18s,border-color .18s}
.tile:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.17)}
.tile:before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,#e0232f,transparent 75%)}
.tile.gold:before{background:linear-gradient(90deg,#e8b04b,transparent 75%)}
.tile .k{color:#9a95a9;font-size:12.5px}
.tile .sm{color:#8b8699;font-size:11.5px;margin-top:4px}
.hero{position:relative;overflow:hidden}
.hero:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 32%,rgba(255,255,255,.07) 46%,transparent 60%);background-size:220% 100%;animation:sheen 7s linear infinite;pointer-events:none}
@keyframes sheen{from{background-position:180% 0}to{background-position:-80% 0}}
/* ===== نظام البنتو (نظرة عامة الجديدة) ===== */
.bento{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;align-items:stretch}
.bc{position:relative;overflow:hidden;border-radius:20px;padding:18px;border:1px solid rgba(255,255,255,.08);
  background:linear-gradient(165deg,rgba(38,34,54,.93),rgba(19,18,27,.95) 62%,rgba(13,12,19,.97));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 20px 44px -14px rgba(0,0,0,.72);
  transition:transform .2s,border-color .2s,box-shadow .2s}
.bc:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 28px 54px -14px rgba(0,0,0,.8)}
.bc:before{content:"";position:absolute;top:-64px;inset-inline-end:-64px;width:176px;height:176px;border-radius:50%;background:radial-gradient(circle,rgba(224,35,47,.20),transparent 70%);pointer-events:none}
.bc.gold:before{background:radial-gradient(circle,rgba(232,176,75,.19),transparent 70%)}
.bc.green:before{background:radial-gradient(circle,rgba(31,157,85,.19),transparent 70%)}
.bc.violet:before{background:radial-gradient(circle,rgba(150,90,255,.19),transparent 70%)}
.bc>*{position:relative}
.s3{grid-column:span 3}.s4{grid-column:span 4}.s5{grid-column:span 5}.s6{grid-column:span 6}.s7{grid-column:span 7}.s8{grid-column:span 8}.s12{grid-column:span 12}
.hd{display:flex;align-items:center;gap:11px;margin-bottom:13px}
.hd .si{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;
  background:linear-gradient(150deg,rgba(232,45,60,.98),rgba(120,10,20,.98));box-shadow:0 9px 20px -7px rgba(179,18,30,.9)}
.hd .si.gold{background:linear-gradient(150deg,#f3c66b,#a9701a);box-shadow:0 9px 20px -7px rgba(200,150,40,.8)}
.hd .si.green{background:linear-gradient(150deg,#2ecf74,#0f5c31);box-shadow:0 9px 20px -7px rgba(31,157,85,.8)}
.hd .si.violet{background:linear-gradient(150deg,#ac7bff,#4a1d9e);box-shadow:0 9px 20px -7px rgba(120,60,220,.8)}
.hd .ti{font-size:14.5px;font-weight:700}
.hd .ts{color:#8b8699;font-size:11.5px;margin-top:2px}
.stnum{font-size:36px;font-weight:700;letter-spacing:-1.6px;line-height:1.05;
  background:linear-gradient(135deg,#fff0dc,#f0566a 62%,#c6152a);-webkit-background-clip:text;background-clip:text;color:transparent}
.stnum.gold{background:linear-gradient(135deg,#fff5db,#e8b04b 62%,#a9701a);-webkit-background-clip:text;background-clip:text;color:transparent}
.lrow{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.lrow:last-child{border-bottom:0}
.rank{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#c6c2d2}
.rank.r1{background:linear-gradient(150deg,#f3c66b,#a9701a);color:#2a1a00;border:0;box-shadow:0 6px 16px -4px rgba(200,150,40,.85)}
.rank.r2{background:linear-gradient(150deg,#e3e8f2,#8c94a8);color:#1b1f28;border:0}
.rank.r3{background:linear-gradient(150deg,#dda06b,#8a5327);color:#2a1500;border:0}
.lnm{flex:1;min-width:0;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lpt{font-size:12.5px;color:#ffb0b8;font-weight:600;flex-shrink:0}
.frow{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.frow:last-child{border-bottom:0}
.fdot{width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0;background:linear-gradient(135deg,#ff5c6c,#8c0f1a);box-shadow:0 0 9px rgba(224,35,47,.75)}
.fmsg{flex:1;min-width:0;font-size:13px;line-height:1.6}
.ftime{color:#7d788e;font-size:11px;margin-top:3px}
.qa{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.qb{display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;cursor:pointer;font:inherit;text-align:right;
  background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.085);color:#e6e3ee;transition:background .16s,transform .12s,border-color .16s}
.qb:hover{background:rgba(224,35,47,.14);border-color:rgba(224,35,47,.45);transform:translateY(-2px)}
.qb .qe{font-size:17px}
@media(max-width:900px){.s3,.s4,.s5,.s6,.s7,.s8{grid-column:span 12}.qa{grid-template-columns:1fr}}
/* ===== رأس موحّد لكل الصفحات ===== */
.phead{display:flex;align-items:center;gap:13px;padding:15px 18px;margin-bottom:18px;border-radius:18px;
  background:linear-gradient(120deg,rgba(224,35,47,.16),rgba(255,255,255,.035) 42%,rgba(255,255,255,.012));
  border:1px solid rgba(255,255,255,.085);box-shadow:inset 0 1px 0 rgba(255,255,255,.055)}
.phic{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;
  background:linear-gradient(150deg,rgba(232,45,60,.98),rgba(120,10,20,.98));
  box-shadow:0 10px 22px -9px rgba(179,18,30,.95),inset 0 0 0 1px rgba(255,255,255,.13)}
.pht{font-size:19px;font-weight:700;letter-spacing:-.2px}
.phs{color:#918c9f;font-size:12.5px;margin-top:3px;line-height:1.7}
@media(max-width:800px){.phead{padding:12px 14px;gap:11px}.phic{width:38px;height:38px;border-radius:12px;font-size:18px}.pht{font-size:16.5px}}
.item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;flex-wrap:wrap;margin-bottom:8px;
  background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.055);
  transition:background .16s,border-color .16s,transform .14s}
.item:hover{background:rgba(255,255,255,.058);border-color:rgba(255,255,255,.15);transform:translateX(-3px)}
.item:last-child{margin-bottom:0}
.item .nm{flex:1;min-width:120px}.tag{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:3px 11px;font-size:12px;color:#c6c2d2;white-space:nowrap}
.cat{display:flex;align-items:center;gap:9px;color:#ff8a96;font-weight:700;font-size:14.5px;margin:4px 0 14px}
.cat:before{content:"";width:4px;height:17px;border-radius:3px;background:linear-gradient(#ff5c6c,#8c0f1a);box-shadow:0 0 10px rgba(224,35,47,.55);flex-shrink:0}
.cat:after{content:"";flex:1;min-width:20px;height:1px;background:linear-gradient(90deg,rgba(224,35,47,.42),transparent)}
.sw{width:18px;height:18px;border-radius:50%;border:1px solid #4a465c;flex-shrink:0}
.tgl{position:relative;display:inline-block;width:54px;height:30px;flex-shrink:0;vertical-align:middle;cursor:pointer}
.tgl input{opacity:0;width:0;height:0;position:absolute}
.tgl .sl{position:absolute;cursor:pointer;inset:0;background:#332f42;border-radius:30px;transition:background .2s,box-shadow .2s;border:1px solid #46425a}
.tgl .sl:before{content:"";position:absolute;height:22px;width:22px;left:3px;top:3px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.tgl input:checked+.sl{background:linear-gradient(135deg,#22b463,#12703b);border-color:#1f9d55;box-shadow:0 0 14px rgba(31,157,85,.45)}
.tgl input:checked+.sl:before{transform:translateX(24px)}
.tgl input:disabled+.sl{opacity:.5;cursor:wait}
.tag.on{background:rgba(31,157,85,.14);border-color:rgba(31,157,85,.55);color:#84e8ab}
.tag.off{background:rgba(155,32,32,.16);border-color:rgba(139,31,42,.7);color:#ff9aa5}
.bar{height:11px;background:#20202b;border:1px solid rgba(255,255,255,.07);border-radius:20px;overflow:hidden}
.bar>i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#ffc79b,#f0566a 55%,#c6152a);transition:width .35s}
.av{width:56px;height:56px;border-radius:50%;border:2px solid #c6152a;object-fit:cover;box-shadow:0 6px 18px rgba(0,0,0,.45)}
.ov{position:fixed;inset:0;background:rgba(4,3,7,.76);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;z-index:60;padding:18px;overflow:auto}
.ovc{background:linear-gradient(180deg,rgba(28,26,38,.98),rgba(17,16,24,.98));border:1px solid rgba(255,255,255,.10);border-radius:18px;padding:18px;width:100%;max-width:640px;margin:auto;box-shadow:0 26px 60px rgba(0,0,0,.6);animation:up .25s ease both}
#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(14px);background:rgba(22,58,38,.97);border:1px solid rgba(31,157,85,.5);padding:11px 20px;border-radius:14px;opacity:0;transition:.28s;pointer-events:none;box-shadow:0 12px 30px rgba(0,0,0,.5);font-size:14px;z-index:90}
#toast.err{background:rgba(62,20,22,.97);border-color:rgba(224,35,47,.55)}
#toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
a.btn{display:inline-block;text-decoration:none;padding:12px 20px;border-radius:12px}
@media(max-width:800px){.app{flex-direction:column}.sb{position:fixed;bottom:0;left:0;right:0;top:auto;height:auto;z-index:30;width:auto;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:8px 8px calc(8px + env(safe-area-inset-bottom));border-left:0;border-top:1px solid rgba(255,255,255,.08);gap:4px}
.logo,.navlab{display:none}.nav{white-space:nowrap;padding:9px 11px;font-size:13.5px;width:auto;gap:7px}.nav.on:before{display:none}
.topbar{padding:11px 14px}.page{padding:16px 14px calc(96px + env(safe-area-inset-bottom))}
.hero{padding:16px;gap:11px}.hero h1{font-size:20px}.uchip .unm{display:none}}
/* 💬 محرر الردود: فقاعات محادثة */
.chat{display:flex;flex-direction:column;gap:8px;margin:8px 0}
.msg{display:flex;gap:8px;align-items:flex-start}
.msg.me{flex-direction:row-reverse}
.aven{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#20202a;border:1px solid #33333f;flex:0 0 auto;font-size:14px}
.bub{max-width:80%;padding:8px 12px;border-radius:14px;background:#191922;border:1px solid #2a2a35;line-height:1.9}
.msg.me .bub{background:linear-gradient(135deg,#3a1622,#25101a);border-color:#5a2233}
.bub .who{font-size:11px;opacity:.6;margin-bottom:2px}
.btext{white-space:pre-wrap;word-break:break-word;font-size:14px}
</style></head><body><canvas id="bg"></canvas><div id="root"></div><div id="toast"></div>
<script>
var $=function(i){return document.getElementById(i)};
// ===== خلفية حيّة: نقاط تسبح وتلمع + خطوط خفيفة بينها (بدل صورة GIF) =====
var BG=null;
(function(){
  var cv=$('bg');if(!cv)return;
  var ctx=null;try{ctx=cv.getContext('2d')}catch(e){}
  if(!ctx)return;
  var W=0,H=0,DPR=1,ps=[],raf=0,run=false;
  var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COL=['255,255,255','255,200,158','255,124,134','255,224,190'];
  function size(){DPR=Math.min(2,window.devicePixelRatio||1);W=cv.clientWidth||window.innerWidth;H=cv.clientHeight||window.innerHeight;cv.width=Math.floor(W*DPR);cv.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);mk()}
  function mk(){var n=Math.max(24,Math.min(78,Math.round(W*H/30000)));ps=[];
    for(var i=0;i<n;i++)ps.push({x:Math.random()*W,y:Math.random()*H,r:.6+Math.random()*1.8,vx:(Math.random()-.5)*.18,vy:(Math.random()-.5)*.18,c:COL[(Math.random()*COL.length)|0],p:Math.random()*6.283,s:.5+Math.random()*1.5})}
  function draw(){
    ctx.clearRect(0,0,W,H);var i,j,dx,dy,d2,a;
    for(i=0;i<ps.length;i++)for(j=i+1;j<ps.length;j++){
      dx=ps[i].x-ps[j].x;dy=ps[i].y-ps[j].y;d2=dx*dx+dy*dy;
      if(d2<13000){a=(1-d2/13000)*.11;ctx.strokeStyle='rgba(232,74,86,'+a.toFixed(3)+')';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ps[i].x,ps[i].y);ctx.lineTo(ps[j].x,ps[j].y);ctx.stroke()}
    }
    for(i=0;i<ps.length;i++){var p=ps[i];
      p.x+=p.vx;p.y+=p.vy;p.p+=.022;
      if(p.x<-12)p.x=W+12;else if(p.x>W+12)p.x=-12;
      if(p.y<-12)p.y=H+12;else if(p.y>H+12)p.y=-12;
      a=.26+Math.abs(Math.sin(p.p*p.s))*.55;
      if(p.r>1.5){ctx.beginPath();ctx.fillStyle='rgba('+p.c+','+(a*.09).toFixed(3)+')';ctx.arc(p.x,p.y,p.r*5,0,6.2832);ctx.fill()}
      ctx.beginPath();ctx.fillStyle='rgba('+p.c+','+a.toFixed(3)+')';ctx.arc(p.x,p.y,p.r,0,6.2832);ctx.fill()
    }
  }
  function loop(){draw();raf=requestAnimationFrame(loop)}
  function start(){if(run||reduce)return;run=true;loop()}
  function stop(){run=false;if(raf)cancelAnimationFrame(raf);raf=0;try{ctx.clearRect(0,0,W,H)}catch(e){}}
  size();window.addEventListener('resize',function(){size();if(!run)draw()});
  document.addEventListener('visibilitychange',function(){if(document.hidden)stop();else if(BG&&BG.want)start()});
  BG={want:true,start:start,stop:stop,toggle:function(){
    BG.want=!BG.want;
    if(BG.want){cv.style.display='';start()}else{stop();cv.style.display='none'}
    try{localStorage.setItem('nova_bg',BG.want?'1':'0')}catch(e){}
    return BG.want}};
  var saved='1';try{saved=localStorage.getItem('nova_bg')||'1'}catch(e){}
  if(saved==='0'){BG.want=false;cv.style.display='none'}else if(reduce){draw()}else start();
})();
function el(t,p,k){var e=document.createElement(t);p=p||{};for(var a in p){if(a==='text')e.textContent=p[a];else if(a==='on'){for(var v in p.on)e.addEventListener(v,p.on[v])}else if(a==='value')e.value=p[a];else e.setAttribute(a,p[a])}(k||[]).forEach(function(c){if(c)e.appendChild(c)});return e}
function opt(v,t){return el('option',{value:v,text:t})}
function toast(m,e){var t=$('toast');t.textContent=m;t.className=(e?'err ':'')+'on';setTimeout(function(){t.className=''},2400)}
function api(p,b){return callApi(p,b,0)}
// نقرأ النص أولاً ثم نحوّله JSON: لو رجع HTML (نفق واقع، أو صفحة خطأ) نعيد المحاولة مرة للطلبات القرائية ونطلع رسالة عربية واضحة
function callApi(p,b,tries){return fetch('/dashboard/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json','x-dash':'1'},body:b?JSON.stringify(b):undefined}).then(function(r){return r.text().then(function(t){
  var j=null;try{j=JSON.parse(t)}catch(e){
    if(!b&&tries<1)return new Promise(function(s){setTimeout(s,800)}).then(function(){return callApi(p,b,tries+1)});
    throw new Error('رد غير متوقع من السيرفر (كود '+r.status+') — حدّث الصفحة (Ctrl+F5) وتأكد من الإنترنت');
  }
  if(!r.ok){if(r.status===401)location.reload();throw new Error(j.error||'خطأ')}
  return j;
})})}
function card(title,child){return el('div',{class:'card'},[title?el('div',{class:'cat',text:title}):null,child])}
function row(k){return el('div',{class:'row'},k)}
function go(fn,msg,page){fn.then(function(){toast(msg||'تم ✅');if(page)show(page)}).catch(function(e){toast(e.message,1)})}
var NOVA_MARK_SVG='<svg width="22" height="22" viewBox="0 0 100 100" style="vertical-align:-5px;margin-left:8px"><defs><radialGradient id="ngc" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff6e8"/><stop offset="45%" stop-color="#ff8a3d"/><stop offset="100%" stop-color="#b3121e"/></radialGradient></defs><g fill="url(#ngc)"><polygon points="50,6 58,42 94,50 58,58 50,94 42,58 6,50 42,42"/><polygon points="50,24 54,42 50,50 46,42" opacity="0"/></g><circle cx="50" cy="50" r="13" fill="url(#ngc)"/></svg>';
function sw(on,fn){var i=el('input',{type:'checkbox'});i.checked=!!on;i.addEventListener('change',function(){fn(i.checked)});var l=el('label',{class:'tgl'},[i,el('span',{class:'sl'})]);l.title='اضغط للتبديل';return l}
var pages={},cur='overview',PAGE_T=null;
var NAV=[['*الرئيسية'],['overview','📊','نظرة عامة'],['bot','🤖','التحكم بالبوت'],['presence','🎮','حالة البوت','super'],['hub','🎛️','لوحة التحكم'],['channels','🗂️','الرومات'],['roles','🎭','الرتب'],['colors','🎨','رتب الألوان'],['levels','🏆','المستويات'],['members','👥','الأعضاء'],['*الرسائل والأنظمة'],['replies','💬','الردود','rep'],['welcome','👋','الترحيب'],['economy','🪙','الاقتصاد'],['giveaway','🎉','القرعات'],['tickets','🎫','التذاكر'],['announce','📣','الإعلانات'],['react','😍','الرياكشن'],['*الإدارة والحماية'],['guilds','🌐','السيرفرات','root'],['access','🔑','صلاحية الدخول','access'],['guard','🛡️','الحماية'],['jail','⛓️','السجن'],['trap','🪤','روم الفخ'],['bans','🚫','المحظورين'],['log','📜','السجل']];
// هل يظهر هالبند؟ (حالة البوت والردود = 👑 لصاحب البوت فقط بسيرفرنا · صلاحية الدخول = لصاحب السيرفر/إدارة نوفا)
function navOk(n,d){var k=n[3];if(!k)return true;if(k==='root')return !!d.isSuper;if(k==='super')return !!(d.nova&&d.isSuper);if(k==='rep')return d.nova?!!d.isSuper:true;if(k==='nova')return !!d.nova;if(k==='access')return !!(d.canManageAccess||d.isSuper);return true}
function navItem(p){var it=null;NAV.forEach(function(n){if(n.length>1&&n[0]===p)it=n});return it}
// يحوّل عنوان الصفحة العادي (h1 + وصف) إلى رأس موحّد جديد — يشتغل تلقائياً على كل الصفحات
function phead(p,m){var hd=null,i;for(i=0;i<m.children.length&&i<3;i++){if(m.children[i].tagName==='H1'){hd=m.children[i];break}}
if(!hd)return;var sub=hd.nextElementSibling,subTxt='';
if(sub&&sub.className&&sub.className.split(' ').indexOf('mut')>=0){subTxt=sub.textContent;m.removeChild(sub)}
m.removeChild(hd);var it=navItem(p);
m.insertBefore(el('div',{class:'phead'},[
  el('div',{class:'phic',text:it?it[1]:'✦'}),
  el('div',{style:'flex:1;min-width:0'},[el('div',{class:'pht',text:it?it[2]:hd.textContent}),subTxt?el('div',{class:'phs',text:subTxt}):null])
]),m.firstChild)}
function show(p){cur=p;if(PAGE_T){clearInterval(PAGE_T);PAGE_T=null}var m=$('main');if(!m)return;m.innerHTML='';m.classList.remove('page');void m.offsetWidth;m.classList.add('page');[].forEach.call(document.querySelectorAll('.nav'),function(n){n.className='nav'+(n.dataset.p===p?' on':'')});pages[p](m).then(function(){phead(p,m)}).catch(function(e){toast(e.message,1)})}
// ===== نظرة عامة: غرفة تحكم (Bento) =====
pages.overview=function(m){return Promise.all([api('overview'),api('ping'),api('levels').catch(function(){return null}),api('log').catch(function(){return null})]).then(function(res){
var d=res[0],p=res[1],lv=res[2]||{},lg=res[3]||{};
function ago(t){var n=Number(t)||0;if(!n)return '';var s=Math.floor((Date.now()-n)/1000);if(s<0)return '';if(s<60)return 'قبل '+s+' ثانية';var mm=Math.floor(s/60);if(mm<60)return 'قبل '+mm+' دقيقة';var hh=Math.floor(mm/60);if(hh<24)return 'قبل '+hh+' ساعة';return 'قبل '+Math.floor(hh/24)+' يوم'}
m.appendChild(el('div',{class:'hero'},[
  el('div',{class:'hlogo',text:'👑'}),
  el('div',{style:'flex:1;min-width:190px'},[el('h1',{text:d.name+' — غرفة التحكم',style:'margin:0;padding-bottom:10px'}),el('div',{class:'sub',text:'لوحة نوفا الملكية — كل تعديل ينفّذ فوراً بدون إعادة تشغيل'})]),
  el('div',{class:'pill '+(p.bot?'on':'off')},[el('span',{class:'pdot'}),el('span',{id:'upt',text:'مدة التشغيل '+p.mins+' دقيقة'})])
]));
var bt=el('div',{class:'bento'});
[['👥','الأعضاء',d.members,'عضو بالسيرفر','',''],['🧩','الرومات',d.channels,'روم وقسم','gold','gold'],['🎭','الرتب',d.roles,'رتبة بالسيرفر','violet',''],['⏱️','مدة التشغيل',p.mins,'دقيقة متواصلة','green','']].forEach(function(x){
  bt.appendChild(el('div',{class:'bc s3 '+x[4]},[
    el('div',{class:'hd'},[el('div',{class:'si '+x[4],text:x[0]}),el('div',{},[el('div',{class:'ti',text:x[1]}),el('div',{class:'ts',text:x[3]})])]),
    el('div',{class:'stnum '+x[5],text:String(x[2])})
  ]));
});
var lb=lv.leaderboard||[];
var lead=el('div',{class:'bc s7 gold'});
lead.appendChild(el('div',{class:'hd'},[el('div',{class:'si gold',text:'🏆'}),el('div',{},[el('div',{class:'ti',text:'المتصدرون'}),el('div',{class:'ts',text:'أعلى النقاط في السيرفر'})])]));
if(!lb.length)lead.appendChild(el('div',{class:'mut',text:'ما فيه نقاط مسجلة بعد.'}));
var mx=lb.length?Math.max(1,Number(lb[0].points)||1):1;
lb.slice(0,5).forEach(function(u,i){var pts=Number(u.points)||0;
  lead.appendChild(el('div',{class:'lrow'},[
    el('div',{class:'rank r'+(i+1),text:i===0?'👑':String(i+1)}),
    el('div',{style:'flex:1;min-width:0'},[el('div',{class:'lnm',text:u.name||'؟'}),el('div',{class:'bar',style:'height:8px;margin-top:6px'},[el('i',{style:'width:'+Math.max(4,Math.round(pts/mx*100))+'%'})])]),
    el('div',{class:'lpt',text:pts.toLocaleString('en-US')})
  ]))});
var sc=el('div',{class:'bc s5 green'});
sc.appendChild(el('div',{class:'hd'},[el('div',{class:'si green',text:'🛰️'}),el('div',{},[el('div',{class:'ti',text:'حالة النظام'}),el('div',{class:'ts',text:'البوت · القاعدة · الرابط'})])]));
sc.appendChild(el('div',{class:'kv'},[
  el('span',{class:'tag '+(p.bot?'on':'off'),text:p.bot?'البوت متصل':'البوت غير جاهز'}),
  el('span',{class:'tag '+(lv.dbReady?'on':'off'),text:lv.dbReady?'قاعدة البيانات تعمل':'قاعدة البيانات متوقفة'}),
  el('span',{class:'tag',text:'إصدار '+String(d.build||'؟')})
]));
sc.appendChild(el('div',{class:'mono',style:'margin-top:12px',text:p.publicUrl||'—'}));
var tst=el('div',{class:'mut',style:'margin-top:8px'});
sc.appendChild(el('div',{class:'row',style:'margin-top:10px'},[
  el('button',{class:'b2',text:'📋 نسخ الرابط',on:{click:function(){if(!p.publicUrl)return toast('ما فيه رابط',1);if(!navigator.clipboard)return toast('انسخه يدوياً: '+p.publicUrl,1);navigator.clipboard.writeText(p.publicUrl).then(function(){toast('تم نسخ الرابط ✅')},function(){toast('انسخه يدوياً: '+p.publicUrl,1)})}}}),
  el('button',{class:'b2',text:'🔍 فحص الاتصال',on:{click:function(){tst.textContent='جاري الفحص...';api('ping').then(function(r){tst.textContent='✅ سليم — البوت '+(r.bot?'شغال':'غير جاهز')+' • '+r.mins+' دقيقة • إصدار '+r.build}).catch(function(e){tst.textContent='❌ '+e.message})}}})
]));
sc.appendChild(tst);
var fc=el('div',{class:'bc s7'});
fc.appendChild(el('div',{class:'hd'},[el('div',{class:'si',text:'📜'}),el('div',{},[el('div',{class:'ti',text:'آخر العمليات'}),el('div',{class:'ts',text:'كل تعديل من اللوحة يُسجَّل هنا'})])]));
var logs=(lg.log||[]).slice(0,6);
if(!logs.length)fc.appendChild(el('div',{class:'mut',text:'ما فيه عمليات مسجلة بعد — أي تعديل تسويه من هنا بيظهر.'}));
logs.forEach(function(x){fc.appendChild(el('div',{class:'frow'},[el('div',{class:'fdot'}),el('div',{class:'fmsg'},[el('div',{text:x.msg||''}),el('div',{class:'ftime',text:(x.by||'؟')+(x.at?' • '+ago(x.at):'')})])]))});
var qc=el('div',{class:'bc s5 violet'});
qc.appendChild(el('div',{class:'hd'},[el('div',{class:'si violet',text:'⚡'}),el('div',{},[el('div',{class:'ti',text:'إجراءات سريعة'}),el('div',{class:'ts',text:'انتقال فوري لأي صفحة'})])]));
var qg=el('div',{class:'qa'});
[['💬','الردود','replies'],['🎨','رتب الألوان','colors'],['🪙','الاقتصاد','economy'],['🎉','القرعات','giveaway'],['👋','الترحيب','welcome'],['📣','الإعلانات','announce'],['🏆','المستويات','levels'],['👥','الأعضاء','members']].forEach(function(q){
  var b=el('button',{class:'qb'},[el('span',{class:'qe',text:q[0]}),el('span',{text:q[1]})]);
  b.addEventListener('click',function(){show(q[2])});qg.appendChild(b);
});
qc.appendChild(qg);
bt.appendChild(lead);bt.appendChild(sc);bt.appendChild(fc);bt.appendChild(qc);
m.appendChild(bt);
var sec=Number(p.uptime)||0,ut=$('upt');
PAGE_T=setInterval(function(){if(!ut)return;sec++;var mm=Math.floor(sec/60),hh=Math.floor(mm/60),dd=Math.floor(hh/24),s='';if(dd)s+=dd+' يوم ';if(hh%24)s+=hh%24+' ساعة ';if(mm%60)s+=mm%60+' دقيقة ';s+=sec%60+' ثانية';ut.textContent='مدة التشغيل '+s},1000);
return Promise.resolve()})};
// ===== الردود: نفس لوحة /panel لكن داخل الداشبورد (بدون كلمة مرور) =====
pages.replies=function(m){return api('rep2').then(function(d){
var isNova=!!(d&&d.isNova),secs=(d&&d.sections)||[],roles=(d&&d.roles)||[],lg=(d&&d.legacy)||null;
var lim=(d&&d.limits)||{sections:30,entries:80,min:3};
var tab='mine',cur=secs.length?secs[0].id:null,lkey=null,LA=null;
m.appendChild(el('h1',{text:'الردود 💬'}));
m.appendChild(el('div',{class:'mut',style:'line-height:1.9',text:'تبني هنا ردود البوت بنفسك: تكتب «كلام العضو» + «رد البوت» ويظهر على شكل محادثة. لكل قسم تحدد مين يشتغل له (شخص · رتبة · الكل)، وتقدر تضيف أكثر من رد لنفس الكلمة — والبوت يختار عشوائي.'}));
var bar=el('div',{class:'row',style:'gap:8px;flex-wrap:wrap;margin:14px 0'}),body=el('div');
m.appendChild(bar);m.appendChild(body);

// ===== فقاعات المحادثة (المعاينة) =====
function bubble(who,icon,text,cls){return el('div',{class:'msg '+cls},[el('div',{class:'aven',text:icon}),el('div',{class:'bub'},[el('div',{class:'who',text:who}),el('div',{class:'btext',text:text})])])}

// ===== الشريط العلوي =====
function drawTabs(){bar.innerHTML='';
 var a=el('button',{class:tab==='mine'?'btn':'b2',text:'🧩 أقسامي ('+secs.length+')'});a.addEventListener('click',function(){tab='mine';draw()});bar.appendChild(a);
 if(isNova){var b=el('button',{class:tab==='legacy'?'btn':'b2',text:'📦 الأقسام الأصلية'});b.addEventListener('click',function(){tab='legacy';draw()});bar.appendChild(b)}
 if(tab==='mine'&&secs.length<lim.sections){var nb=el('button',{class:'b2',text:'➕ قسم جديد'});
  nb.addEventListener('click',function(){nb.disabled=true;api('rep2/section',{act:'add',name:'قسم جديد',emoji:'💬'}).then(function(r){secs=r.sections;cur=r.id;draw();toast('انضاف قسم جديد ✅')}).catch(function(e){nb.disabled=false;toast(e.message,1)})});
  bar.appendChild(nb)}
}

// ===== كرت إعدادات القسم =====
function sectionCard(s){
 var nm=el('input',{value:s.name,style:'flex:1;min-width:150px'});
 var em=el('input',{value:s.emoji,style:'width:62px;text-align:center;font-size:20px'});
 var tt=el('select',{},[opt('all','🌐 الكل'),opt('role','🎭 رتبة'),opt('user','👤 شخص')]);tt.value=s.target&&s.target.type?s.target.type:'all';
 var rs=el('select',{},[opt('','— اختر رتبة —')].concat(roles.map(function(r){return opt(r.id,r.name)})));rs.value=(s.target&&s.target.type==='role')?s.target.id:'';
 var us=el('input',{placeholder:'آيدي الشخص',style:'flex:1;min-width:150px',value:(s.target&&s.target.type==='user')?s.target.id:''});
 var st={enabled:s.enabled,anywhere:s.anywhere,dm:s.dm};
 var swEn=sw(s.enabled,function(v){st.enabled=v}),swAn=sw(s.anywhere,function(v){st.anywhere=v}),swDm=sw(s.dm,function(v){st.dm=v});
 function syncT(){rs.style.display=tt.value==='role'?'':'none';us.style.display=tt.value==='user'?'':'none'}
 tt.addEventListener('change',syncT);syncT();
 var save=el('button',{class:'btn',text:'💾 حفظ القسم'});
 save.addEventListener('click',function(){save.disabled=true;
  api('rep2/section',{act:'edit',id:s.id,patch:{name:nm.value,emoji:em.value,enabled:st.enabled,anywhere:st.anywhere,dm:st.dm,target:{type:tt.value,id:tt.value==='role'?rs.value:(tt.value==='user'?us.value:'')}}}).then(function(r){secs=r.sections;toast('انحفظ ✅');draw()}).catch(function(e){save.disabled=false;toast(e.message,1)})});
 var mv1=el('button',{class:'b2',text:'▲ فوق'}),mv2=el('button',{class:'b2',text:'▼ تحت'}),dl=el('button',{class:'dn',text:'🗑️ حذف القسم'});
 mv1.addEventListener('click',function(){api('rep2/section',{act:'move',id:s.id,dir:'up'}).then(function(r){secs=r.sections;draw()}).catch(function(e){toast(e.message,1)})});
 mv2.addEventListener('click',function(){api('rep2/section',{act:'move',id:s.id,dir:'down'}).then(function(r){secs=r.sections;draw()}).catch(function(e){toast(e.message,1)})});
 dl.addEventListener('click',function(){if(!confirm('حذف القسم «'+s.name+'» وكل ردوده؟'))return;
  api('rep2/section',{act:'del',id:s.id}).then(function(r){secs=r.sections;cur=secs.length?secs[0].id:null;draw();toast('انحذف')}).catch(function(e){toast(e.message,1)})});
 return card('⚙️ إعدادات القسم',el('div',{},[
   el('div',{class:'row',style:'gap:8px;flex-wrap:wrap'},[em,nm]),
   el('div',{class:'row',style:'gap:8px;flex-wrap:wrap;margin-top:10px'},[el('span',{class:'mut',text:'يشتغل لـ:'}),tt,rs,us]),
   el('div',{class:'row',style:'gap:16px;flex-wrap:wrap;margin-top:12px'},[
     el('div',{class:'row'},[swEn,el('span',{text:'القسم مفعّل'})]),
     el('div',{class:'row'},[swAn,el('span',{text:'بدون مناداة'})]),
     el('div',{class:'row'},[swDm,el('span',{text:'يشتغل بالخاص 📩'})])
   ]),
   el('div',{class:'mut',style:'margin-top:8px;font-size:12px',text:'«بدون مناداة» مطفّي = يرد بس لما أحد ينادي البوت (يا عبد …). لو شغّلته يرد على الكلمة بأي رسالة — استخدمه بحكمة عشان ما يزعج.'}),
   el('div',{class:'row',style:'gap:8px;flex-wrap:wrap;margin-top:12px'},[save,mv1,mv2,dl])
 ]));
}

// ===== كرت إضافة رد (المربعين) =====
function addCard(s){
 var t=el('input',{placeholder:'كلام العضو — مثال: صباح الخير',style:'width:100%'});
 var r=el('textarea',{placeholder:'رد البوت — يقبل أكثر من سطر',style:'width:100%;min-height:90px;margin-top:6px'});
 var md=el('select',{style:'margin-top:8px'},[opt('contains','🔍 داخل الكلام — أي رسالة فيها الكلمة'),opt('exact','🎯 مطابقة تامة — الرسالة كلها نفس الكلمة')]);
 var add=el('button',{class:'btn',text:'➕ إضافة الرد'});
 add.addEventListener('click',function(){
  if(!String(t.value||'').trim())return toast('اكتب «كلام العضو»',1);
  if(!String(r.value||'').trim())return toast('اكتب «رد البوت»',1);
  add.disabled=true;
  api('rep2/entry',{act:'add',sid:s.id,t:t.value,mode:md.value,r:[r.value]}).then(function(x){secs=x.sections;toast('انضاف ✅');draw()}).catch(function(e){add.disabled=false;toast(e.message,1)})});
 return card('✍️ أضف رد جديد',el('div',{},[
   el('div',{class:'mut',text:'كلام العضو (الكلمة اللي تنتظرها)'}),t,
   el('div',{class:'mut',style:'margin-top:10px',text:'رد البوت'}),r,
   md,
   el('div',{class:'row',style:'gap:8px;margin-top:10px'},[add]),
   el('div',{class:'mut',style:'margin-top:8px;font-size:12px',text:'متغيرات: {user} = منشن العضو · {name} = اسمه · {server} = اسم السيرفر. وللرد العشوائي: أضف نفس الكلمة مرتين، أو اكتب أكثر من سطر بمربع «رد البوت».'})
 ]));
}

// ===== محرر رد واحد (يظهر فوق الكرت نفسه) =====
function entryEditor(s,e){
 var box=el('div');
 var t=el('input',{value:e.t,style:'width:100%'});
 var r=el('textarea',{style:'width:100%;min-height:90px;margin-top:6px'});
 r.value=(e.r||[]).join('\\n');
 var md=el('select',{style:'margin-top:8px'},[opt('contains','🔍 داخل الكلام'),opt('exact','🎯 مطابقة تامة')]);md.value=e.mode;
 var sv=el('button',{class:'btn',text:'💾 حفظ الرد'}),cx=el('button',{class:'b2',text:'✖ إلغاء'});
 cx.addEventListener('click',function(){draw()});
 sv.addEventListener('click',function(){
  sv.disabled=true;
  api('rep2/entry',{act:'edit',sid:s.id,eid:e.id,patch:{t:t.value,mode:md.value,r:String(r.value||'').split('\\n').map(function(x){return x.trim()}).filter(Boolean)}})
   .then(function(x){secs=x.sections;toast('انحفظ ✅');draw()}).catch(function(z){sv.disabled=false;toast(z.message,1)})});
 box.appendChild(el('div',{class:'mut',text:'كلام العضو'}));box.appendChild(t);
 box.appendChild(el('div',{class:'mut',style:'margin-top:8px',text:'رد البوت — كل سطر = رد (يختار عشوائي)'}));box.appendChild(r);
 box.appendChild(md);
 box.appendChild(el('div',{class:'row',style:'gap:8px;margin-top:8px'},[sv,cx]));
 return box;
}

// ===== كرت رد واحد =====
function entryCard(s,e){
 var wrap=el('div',{class:'ecard',style:'border:1px solid #2a2a35;border-radius:14px;padding:10px;margin-bottom:10px'});
 var dup=s.entries.filter(function(x){return x.id!==e.id&&String(x.t||'').trim()===String(e.t||'').trim()}).length;
 wrap.appendChild(el('div',{class:'row',style:'gap:6px;flex-wrap:wrap;margin-bottom:8px'},[
   el('span',{class:'tag',text:e.mode==='exact'?'🎯 مطابقة تامة':'🔍 داخل الكلام'}),
   el('span',{class:'tag '+(e.on?'on':'off'),text:e.on?'مفعّل':'موقوف'}),
   dup?el('span',{class:'tag',text:'🔀 '+((e.r||[]).length+dup)+' ردود عشوائية'}):null
 ]));
 wrap.appendChild(bubble('العضو','👤',e.t,'me'));
 (e.r||[]).forEach(function(t){wrap.appendChild(bubble('البوت','🤖',t,'bot'))});
 var ed=el('button',{class:'b2',text:'✏️ تعديل'}),vo=el('button',{class:'b2',text:e.on?'⏸️ إيقاف':'▶️ تشغيل'}),de=el('button',{class:'dn',text:'🗑️ حذف'});
 ed.addEventListener('click',function(){wrap.innerHTML='';wrap.appendChild(entryEditor(s,e))});
 vo.addEventListener('click',function(){api('rep2/entry',{act:'edit',sid:s.id,eid:e.id,patch:{on:!e.on}}).then(function(x){secs=x.sections;draw()}).catch(function(z){toast(z.message,1)})});
 de.addEventListener('click',function(){if(!confirm('حذف هذا الرد؟'))return;
  api('rep2/entry',{act:'del',sid:s.id,eid:e.id}).then(function(x){secs=x.sections;draw();toast('انحذف')}).catch(function(z){toast(z.message,1)})});
 wrap.appendChild(el('div',{class:'row',style:'gap:8px;flex-wrap:wrap;margin-top:10px'},[ed,vo,de]));
 return wrap;
}

// ===== تبويب «أقسامي» =====
function drawMine(){
 if(!secs.length){body.appendChild(card('',el('div',{class:'mut',style:'line-height:2',text:'ما عندك أقسام بعد. اضغط «➕ قسم جديد» فوق، وبعدها اكتب أول رد.'})));return}
 var side=el('div',{class:'card'},[el('div',{class:'cat',text:'الأقسام 📂'})]);
 var list=el('div');
 secs.forEach(function(s){
  var b=el('button',{class:'ritem'+(s.id===cur?' on':''),style:'width:100%;text-align:right'},[el('span',{class:'rn',text:(s.emoji||'💬')+' '+s.name}),el('span',{class:'rc',text:String(s.entries.length)})]);
  b.addEventListener('click',function(){cur=s.id;draw()});list.appendChild(b)});
 side.appendChild(list);
 var s=null;secs.forEach(function(x){if(x.id===cur)s=x});if(!s){s=secs[0];cur=s.id}
 var pane=el('div');
 pane.appendChild(sectionCard(s));
 pane.appendChild(addCard(s));
 var ec=el('div');
 if(!s.entries.length)ec.appendChild(el('div',{class:'mut',style:'padding:8px',text:'ما فيه ردود بعد — أضف أول رد من الكرت فوق.'}));
 s.entries.forEach(function(e){ec.appendChild(entryCard(s,e))});
 pane.appendChild(card('💬 الردود ('+s.entries.length+')',ec));
 body.appendChild(el('div',{class:'rgrid'},[side,pane]));
}

// ===== تبويب «الأقسام الأصلية» (نوفا فقط — نفس المحرر القديم) =====
var L={greet:'ترحيب',food:'أكل',hit:'ضرب',rude:'إهانة',thanks:'شكر',where:'وينك',move:'قوم/تحرك',status:'الحالة',help:'مساعدة',poems:'شعر',jokes:'نكت',alerts:'تنبيهات',welcome:'ترحيب الفويس',custom:'كلمات خاصة',games:'الألعاب'};
var T={arthur:'ارثر',ida:'إيدا',royal:'الرتبة الملكية',peasant:'بدون رتبة (الكل)',disrespect:'رتبة بدون احترام',all:'الكل',sentences:'جمل سرعة الكتابة',words:'كلمات المبعثرة',flags:'الأعلام',rawan:'روان',nabd:'نبض ارثر'};
function rlab(k){var p=k.split('.');return (L[p[0]]||p[0])+(p[1]?' ← '+(T[p[1]]||p[1]):'')}
function rhint(k){return k.indexOf('custom.')===0?'الصيغة: الكلمة => الرد   (مثال: صباح الخير => صباح النور)':k==='games.flags'?'الصيغة: العلم => اسم الدولة | اسم ثاني   (مثال: 🇸🇦 => السعودية)':k.indexOf('games.')===0?'كل سطر = عنصر واحد، بدون تشكيل':''}
function drawLegacy(){
 var D={all:(lg&&lg.all)||{},custom:(lg&&lg.custom)||{}};
 var keys=Object.keys(D.all).sort();
 if(!lkey||!D.all[lkey])lkey=keys[0]||null;
 var kw=el('input',{placeholder:'🔍 ابحث عن تصنيف…',style:'width:100%'});
 var list=el('div');
 function drawList(f){list.innerHTML='';var n=0;
  keys.forEach(function(k){
   if(f&&k.toLowerCase().indexOf(f)<0&&rlab(k).indexOf(f)<0)return;n++;
   var b=el('button',{class:'ritem'+(k===lkey?' on':''),style:'width:100%;text-align:right'},[el('span',{class:'rn',text:rlab(k)}),D.custom[k]?el('span',{class:'rc',style:'color:#84e8ab',text:'معدّل'}):null,el('span',{class:'rc',text:'('+((D.all[k]||[]).length)+')'})]);
   b.addEventListener('click',function(){lkey=k;draw()});list.appendChild(b)});
  if(!n)list.appendChild(el('div',{class:'mut',style:'padding:8px',text:'ما فيه نتائج'}))}
 kw.addEventListener('input',function(){drawList(kw.value.trim().toLowerCase())});
 drawList('');
 var side=el('div',{class:'card'},[el('div',{class:'cat',text:'التصنيفات 📂'}),kw,list]);
 var pane=el('div',{class:'card'});
 if(!lkey){pane.appendChild(el('div',{class:'mut',text:'اختر تصنيف من القائمة.'}))}
 else{
  pane.appendChild(el('div',{class:'cat',text:'✏️ '+rlab(lkey)}));
  pane.appendChild(el('div',{class:'kv'},[el('span',{class:'tag mono',text:lkey}),D.custom[lkey]?el('span',{class:'tag on',text:'معدّل يدوياً'}):el('span',{class:'tag',text:'افتراضي'})]));
  var h=rhint(lkey);if(h)pane.appendChild(el('div',{class:'mut',style:'margin:4px 0 8px',text:h}));
  var ta=el('textarea',{spellcheck:'false',style:'min-height:320px;width:100%'});
  ta.value=(D.all[lkey]||[]).join('\\n');pane.appendChild(ta);
  var cnt=el('div',{class:'mut',style:'margin-top:6px'});
  function up(){cnt.textContent='عدد الردود: '+ta.value.split('\\n').filter(function(x){return x.trim()}).length}
  up();ta.addEventListener('input',up);pane.appendChild(cnt);
  var sv=el('button',{class:'btn',text:'💾 حفظ'}),rs=el('button',{class:'b2',text:'↩️ الافتراضي / حذف'});
  sv.addEventListener('click',function(){sv.disabled=true;
   api('replies/save',{key:lkey,lines:ta.value.split('\\n')}).then(function(r){lg={all:r.all,custom:r.custom};toast('انحفظ ✅');draw()}).catch(function(e){sv.disabled=false;toast(e.message,1)})});
  rs.addEventListener('click',function(){if(!confirm('رجوع للردود الافتراضية؟ (لو تصنيف أنشأته إنت، بينحذف كامل)'))return;
   api('replies/reset',{key:lkey}).then(function(r){lg={all:r.all,custom:r.custom};toast('رجع للافتراضي');draw()}).catch(function(e){toast(e.message,1)})});
  pane.appendChild(el('div',{class:'row',style:'gap:8px;margin-top:10px'},[sv,rs]));
 }
 var bk=el('button',{class:'b2',text:'⬇️ نسخة احتياطية'}),im=el('button',{class:'b2',text:'⬆️ استيراد'}),fi=el('input',{type:'file',accept:'.json',style:'display:none'});
 bk.addEventListener('click',function(){var a=el('a',{href:URL.createObjectURL(new Blob([JSON.stringify(D.custom,null,2)],{type:'application/json'}))});a.download='replies-backup.json';a.click()});
 im.addEventListener('click',function(){fi.click()});
 fi.addEventListener('change',function(ev){var f=ev.target.files&&ev.target.files[0];if(!f)return;var rd=new FileReader();
  rd.onload=function(){try{var mp=JSON.parse(rd.result);api('replies/import',{map:mp}).then(function(x){lg={all:x.all,custom:x.custom};toast('تم استيراد '+x.imported+' تصنيف ✅');draw()}).catch(function(z){toast(z.message,1)})}catch(z){toast('ملف غير صالح',1)}};rd.readAsText(f)});
 var cc=card('📦 نسخة احتياطية',el('div',{},[
  el('div',{class:'mut',style:'line-height:1.9',text:'هذي الأقسام الأصلية للبوت (ترحيب · أكل · ضرب · شكر · الحالة …) — سلوكها ما تغيّر. كل سطر = رد، والبوت يختار واحد عشوائي.'}),
  el('div',{class:'row',style:'gap:8px;margin-top:10px'},[bk,im,fi])
 ]));
 body.appendChild(el('div',{class:'rgrid'},[side,pane]));
 body.appendChild(cc);
}

// ===== رسم =====
function draw(){drawTabs();body.innerHTML='';if(tab==='legacy')drawLegacy();else drawMine()}
draw();
return;
})};
pages.bot=function(m){return api('bot').then(function(d){var c=d.config;
m.appendChild(el('h1',{text:'التحكم بالبوت'}));
m.appendChild(el('div',{class:'mut',text:'حدّد الرومات المسموح للبوت يتفاعل فيها، وفعّل/عطّل البوت في أي روم بنقرة وحدة. في وضع "الرومات المحددة فقط" البوت يتجاهل أي رسالة أو أمر خارج الرومات المفعّلة تماماً. تنبيه: الحظر التلقائي في روم الفخ نظام مستقل وما يتأثر بهذي الإعدادات أبداً.'}));
var mb=el('div',{class:'card'});
mb.appendChild(el('div',{class:'row'},[sw(c.restrict,function(v){api('bot/save',{restrict:v}).then(function(){toast(v?'الوضع: رومات محددة فقط ✅':'الوضع: كل الرومات ✅');show('bot')}).catch(function(e){toast(e.message,1);show('bot')})}),el('span',{text:'وضع "الرومات المحددة فقط" (White-list) — '+(c.restrict?'مفعّل: البوت يشتغل بس بالرومات المفعّلة تحت':'معطّل: البوت يشتغل بكل الرومات')})]));
m.appendChild(mb);
var texts=d.channels.filter(function(x){return x.type==='text'});
function bulk(v){var ids=texts.map(function(x){return x.id});if(!ids.length)return toast('ما فيه رومات',1);if(!confirm(v?'تفعيل البوت في كل الرومات؟':'تعطيل البوت في كل الرومات؟'))return;go(api('bot/channels',{ids:ids,value:v}),'تم ✅','bot')}
var tb=el('div',{class:'card'});
tb.appendChild(el('div',{class:'cat',text:'الرومات الكتابية — مفتاح تفعيل/تعطيل البوت في كل روم'}));
tb.appendChild(el('div',{class:'row',style:'margin:6px 0 10px'},[
  el('button',{class:'b2',text:'✅ تفعيل الكل',on:{click:function(){bulk(true)}}}),
  el('button',{class:'b2',text:'⛔ تعطيل الكل',on:{click:function(){bulk(false)}}}),
  el('button',{class:'b2',text:'↺ رجوع للافتراضي',on:{click:function(){if(confirm('يمسح كل التفعيلات اليدوية ويرجع للوضع الافتراضي؟'))go(api('bot/channels',{mode:'clear'}),'تم ✅','bot')}}})
]));
texts.forEach(function(x){
  var s=sw(x.enabled,function(v){api('bot/channel',{id:x.id,value:v}).then(function(){toast((v?'✅ مفعّل في ':'⛔ معطّل في ')+'#'+x.name);show('bot')}).catch(function(e){toast(e.message,1);show('bot')})});
  tb.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:'# '+x.name}),x.explicit?null:el('span',{class:'tag',text:'افتراضي'}),el('span',{class:'tag '+(x.enabled?'on':'off'),text:x.enabled?'مفعّل':'معطّل'}),s]));
});
m.appendChild(tb);
var vst=d.voice||{};
var vc=el('div',{class:'card'});
vc.appendChild(el('div',{class:'cat',text:'الروم الصوتي (وجود البوت بالفويس)'}));
vc.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:'الحالة الحالية: '+(vst.inVoice?('متصل ✅'+(vst.channelName?' بـ '+vst.channelName:'')):'غير متصل ❌')}),el('span',{class:'tag '+(c.voiceEnabled?'on':'off'),text:c.voiceEnabled?'المفتاح مفعّل':'المفتاح معطّل'}),sw(c.voiceEnabled,function(v){api('bot/save',{voiceEnabled:v}).then(function(){toast(v?'البوت يدخل الفويس ✅':'البوت يطلع من الفويس ⛔');show('bot')}).catch(function(e){toast(e.message,1);show('bot')})})]));
vc.appendChild(el('div',{class:'mut',text:'الروم الصوتي اللي يجلس فيه البوت:'}));
var vs=el('select',{},[opt('','الروم الافتراضي')].concat(d.voiceChannels.map(function(x){return opt(x.id,'🔊 '+x.name)})));vs.value=c.voiceChannelId||'';
vs.addEventListener('change',function(){api('bot/save',{voiceChannelId:vs.value}).then(function(){toast('تم تحديث الروم الصوتي ✅');show('bot')}).catch(function(e){toast(e.message,1);show('bot')})});
vc.appendChild(vs);
vc.appendChild(el('p'));
vc.appendChild(el('div',{class:'row'},[
  el('button',{class:'btn',text:'🎙️ دخول الفويس الآن',on:{click:function(){go(api('bot/voice',{action:'join'}),'البوت دخل الفويس ✅','bot')}}}),
  el('button',{class:'dn',text:'🚪 خروج من الفويس',on:{click:function(){go(api('bot/voice',{action:'leave'}),'البوت طلع من الفويس ✅','bot')}}})
]));
vc.appendChild(el('div',{class:'mut',style:'margin-top:8px',text:'التحكم السريع: /تعال و /اطع، أو بالكلام "يا عبد تعال" و "يا عبد اطلع". وفك/تشغيل البوت في الروم الكتابي: "يا عبد فك البوت" و "يا عبد شغل البوت".'}));
m.appendChild(vc);
return Promise.resolve()})};
pages.channels=function(m){return api('channels').then(function(d){
m.appendChild(el('h1',{text:'الرومات'}));var cats=d.channels.filter(function(c){return c.type==='category'});
var name=el('input',{placeholder:'الاسم'}),type=el('select',{},[opt('text','روم نصي'),opt('voice','روم فويس'),opt('category','قسم')]),par=el('select',{},[opt('','بدون قسم')].concat(cats.map(function(c){return opt(c.id,c.name)})));
m.appendChild(card('إنشاء جديد',row([name,type,par,el('button',{class:'btn',text:'إنشاء',on:{click:function(){go(api('channels/create',{name:name.value,type:type.value,parentId:par.value}),'تم الإنشاء ✅','channels')}}})])));
function line(c){var k=[el('span',{class:'tag',text:c.type==='text'?'نصي':c.type==='voice'?'فويس':'قسم'}),el('span',{class:'nm',text:c.name}),
el('button',{class:'b2',text:'تسمية',on:{click:function(){var n=prompt('الاسم الجديد',c.name);if(n)go(api('channels/edit',{id:c.id,name:n}),'تم ✅','channels')}}})];
if(c.type!=='category'){var s=el('select',{},[opt('','بدون قسم')].concat(cats.map(function(x){return opt(x.id,x.name)})));s.value=c.parentId||'';s.addEventListener('change',function(){go(api('channels/edit',{id:c.id,parentId:s.value}),'تم النقل ✅','channels')});k.push(s)}
k.push(el('button',{class:'dn',text:'حذف',on:{click:function(){if(confirm('تأكيد حذف: '+c.name+' ؟ ما ينرجع'))go(api('channels/delete',{id:c.id,confirm:true}),'تم الحذف','channels')}}}));return el('div',{class:'item'},k)}
var box=el('div',{class:'card'});var none=d.channels.filter(function(c){return c.type!=='category'&&!c.parentId});
if(none.length){box.appendChild(el('div',{class:'cat',text:'بدون قسم'}));none.forEach(function(c){box.appendChild(line(c))})}
cats.forEach(function(g){box.appendChild(el('div',{class:'cat',text:'قسم'}));box.appendChild(line(g));d.channels.filter(function(c){return c.parentId===g.id}).forEach(function(c){box.appendChild(line(c))})});m.appendChild(box)})};
pages.roles=function(m){return api('roles').then(function(d){
m.appendChild(el('h1',{text:'الرتب'}));var name=el('input',{placeholder:'اسم الرتبة'}),col=el('input',{type:'color',value:'#b3121e'});
m.appendChild(card('رتبة جديدة',row([name,col,el('button',{class:'btn',text:'إنشاء',on:{click:function(){go(api('roles/create',{name:name.value,color:col.value}),'تم الإنشاء ✅','roles')}}})])));
var box=el('div',{class:'card'});d.roles.forEach(function(r){var k=[el('span',{class:'sw',style:'background:'+r.color}),el('span',{class:'nm',text:r.name})];
if(r.editable){var c=el('input',{type:'color',value:r.color});c.addEventListener('change',function(){go(api('roles/edit',{id:r.id,color:c.value}),'تم تغيير اللون ✅','roles')});k.push(c);
k.push(el('button',{class:'b2',text:'تسمية',on:{click:function(){var n=prompt('الاسم الجديد',r.name);if(n)go(api('roles/edit',{id:r.id,name:n}),'تم ✅','roles')}}}));
k.push(el('button',{class:'dn',text:'حذف',on:{click:function(){if(confirm('تأكيد حذف الرتبة: '+r.name+' ؟'))go(api('roles/delete',{id:r.id,confirm:true}),'تم الحذف','roles')}}}))}else k.push(el('span',{class:'tag',text:'محمية'}));
box.appendChild(el('div',{class:'item'},k))});m.appendChild(box)})};
// ===== رتب الألوان: روم البانل + إدارة الألوان + إزالة شاملة =====
pages.colors=function(m){return api('colors').then(function(d){var c=d.config;
var nf=function(n){return Number(n||0).toLocaleString('en-US')};
m.appendChild(el('h1',{text:'رتب الألوان'}));
m.appendChild(el('div',{class:'mut',text:'نظام ألوان كامل: صورة ألوان تُولَّد بالكانفس (Canvas) فيها شبكة الألوان مرقّمة، تنزل مع بانل الروم كصورة رئيسية، وتحتها قائمة اختيار أرقام فقط — العضو يشوف الرقم بالصورة ويختاره فياخذ الرتبة وتنشال عنه باقي الألوان (لون واحد لكل عضو). الحد الأقصى '+d.max+' لون — لو زادت عن 25 تنقسم تلقائياً على قوائم (5 قوائم × 25).'}));
if(d.needPerm)m.appendChild(card('',el('div',{class:'mut',style:'color:#ff8a8a',text:'⚠️ البوت ما عنده صلاحية Manage Roles أو رتبته مو فوق رتب الألوان — أعطه الصلاحية وارفعه فوق الألوان عشان الإدارة تشتغل.'})));

var pre=el('div',{class:'card'});
pre.appendChild(el('div',{class:'cat',text:'٠) تجهيز الألوان الصريحة ('+d.presets.length+' لون) 🎨'}));
pre.appendChild(el('div',{class:'mut',text:'ينشئ هذي الألوان كرتب بالسيرفر بنفس الأكواد بالضبط، ويصحّح كود أي رتبة موجودة بنفس الاسم، ويخلي قائمة الألوان عليهم بالترتيب. (البوت يسويها تلقائياً أول اتصال لو القائمة فاضية).'}));
var wrap=el('div',{class:'row',style:'margin:10px 0'});
d.presets.forEach(function(p){wrap.appendChild(el('span',{class:'tag'},[el('span',{class:'sw',style:'background:'+p.color}),el('span',{text:' '+p.name+'  '+p.color})]))});
pre.appendChild(wrap);
var delOld=sw(false,function(){});
pre.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:'احذف ألوان القائمة القديمة (اللي مو ضمن الألوان الصريحة) من السيرفر نهائياً'}),delOld]));
pre.appendChild(el('div',{class:'row'},[el('button',{class:'btn',text:'🎨 تجهيز الألوان الصريحة الآن',on:{click:function(){
  var b={deleteOld:delOld.querySelector('input').checked};
  if(b.deleteOld&&!confirm('تأكيد: نحذف الألوان القديمة من السيرفر نهائياً (وتنشال من كل الأعضاء)؟'))return;
  api('colors/preset',b).then(function(r){
    var m='جهّزنا '+r.roles.length+' لون (جديد '+r.created+(r.fixed?' • مصحّح '+r.fixed:'')+(r.deleted?' • محذوف '+r.deleted:'')+')';
    if(r.warn&&r.warn.length)m+=' — تنبيه: '+r.warn[0];
    toast(m);show('colors');
  }).catch(function(e){toast(e.message,1)})
}}})]));
m.appendChild(pre);

var chs=el('select',{},[opt('','— اختر روم —')].concat(d.channels.map(function(x){return opt(x.id,'# '+x.name)})));chs.value=c.channelId||'';
var ti=el('input',{placeholder:'عنوان قائمة الألوان',value:c.title||'',style:'flex:1;min-width:190px'});
var de=el('textarea',{placeholder:'وصف قائمة الألوان'});de.value=c.desc||'';
var c1=el('div',{class:'card'});
c1.appendChild(el('div',{class:'cat',text:'١) روم قائمة الألوان 📍'}));
c1.appendChild(row([chs,el('button',{class:'btn',text:'💾 حفظ الإعدادات',on:{click:function(){go(api('colors/save',{channelId:chs.value,title:ti.value,desc:de.value}),'انحفظ ✅','colors')}}})]));
c1.appendChild(el('div',{class:'mut',style:'margin:8px 0',text:'الحالة: '+(c.channelName?'الروم #'+c.channelName:'ما تحدد روم بعد')+(c.messageId?' • البانل مرسل ومربوط ✅':' • ما فيه بانل مرسل حالياً')}));
c1.appendChild(row([el('span',{class:'mut',text:'العنوان'}),ti]));
c1.appendChild(el('div',{style:'margin-top:10px'},[de]));
c1.appendChild(el('div',{class:'row',style:'margin-top:10px'},[
  el('button',{class:'btn',text:'🔄 تحديث البانل الحالي',on:{click:function(){if(!c.channelId)return toast('حدّد الروم واحفظ أول',1);go(api('colors/panel',{}),'انحدّث البانل ✅')}}}),
  el('button',{class:'b2',text:'📨 إعادة إرسال البانل',on:{click:function(){if(!c.channelId)return toast('حدّد الروم واحفظ أول',1);if(!confirm('نرسل بانل ألوان جديد بالروم (وتنحذف الرسالة القديمة)؟'))return;go(api('colors/panel',{resend:true}),'انرسل البانل ✅','colors')}}})
]));
m.appendChild(c1);

var nm=el('input',{placeholder:'اسم اللون — مثال: أحمر ملكي',style:'flex:1;min-width:170px'}),col=el('input',{type:'color',value:'#b3121e'});
var c2=el('div',{class:'card'});
c2.appendChild(el('div',{class:'cat',text:'٢) إضافة لون جديد ➕'}));
c2.appendChild(row([nm,col,el('button',{class:'btn',text:'إنشاء رتبة لون',on:{click:function(){if(!nm.value.trim())return toast('اكتب اسم اللون',1);go(api('colors/add',{name:nm.value,color:col.value}),'انضاف اللون ✅','colors')}}})]));
c2.appendChild(el('div',{class:'mut',style:'margin-top:12px',text:'أو اربط رتبة موجودة بالسيرفر كلون (بدون ما ينشئ رتبة جديدة):'}));
var ex=el('select',{style:'flex:1;min-width:180px'},[opt('','— اختر رتبة موجودة —')].concat(d.guildRoles.map(function(r){return opt(r.id,r.name+' ('+r.color+')')})));
c2.appendChild(row([ex,el('button',{class:'b2',text:'🔗 ربط كلون',on:{click:function(){if(!ex.value)return toast('اختر رتبة',1);go(api('colors/add',{roleId:ex.value}),'انربط ✅','colors')}}})]));
m.appendChild(c2);

var counts={};
var c3=el('div',{class:'card'});
c3.appendChild(el('div',{class:'cat',text:'٣) الألوان المضافة ('+c.roles.length+' / '+d.max+')'}));
if(!c.roles.length)c3.appendChild(el('div',{class:'mut',text:'ما فيه ألوان بعد — أضف أول لون من فوق.'}));
c.roles.forEach(function(r,ix){
  var cc=el('input',{type:'color',value:r.color});
  cc.addEventListener('change',function(){go(api('colors/edit',{id:r.id,color:cc.value}),'تغيّر اللون ✅','colors')});
  var ce=el('span',{class:'tag',text:'... عضو'});counts[r.id]=ce;
  c3.appendChild(el('div',{class:'item'},[
    el('span',{class:'tag',text:'رقم '+(ix+1)}),
    el('span',{class:'sw',style:'background:'+r.color}),
    el('span',{class:'nm',text:r.name}),
    el('span',{class:'tag',text:r.color}),
    ce,cc,
    el('button',{class:'b2',text:'✏️ تسمية',on:{click:function(){var n=prompt('اسم اللون الجديد',r.name);if(n)go(api('colors/edit',{id:r.id,name:n}),'تم ✅','colors')}}}),
    el('button',{class:'b2',text:'إزالة من القائمة',on:{click:function(){if(confirm('نشيل اللون من القائمة؟ (الرتبة تبقى موجودة بالسيرفر)'))go(api('colors/delete',{id:r.id,confirm:true}),'انشال من القائمة ✅','colors')}}}),
    el('button',{class:'dn',text:'حذف الرتبة نهائياً',on:{click:function(){if(confirm('تأكيد: نحذف رتبة '+r.name+' نهائياً من السيرفر (وتنشال من كل الأعضاء)؟'))go(api('colors/delete',{id:r.id,confirm:true,deleteRole:true}),'انحذفت الرتبة','colors')}}})
  ]));
});
m.appendChild(c3);

// ===== ٤) صورة الألوان المولّدة (Canvas) =====
var cImg=el('div',{class:'card'});
cImg.appendChild(el('div',{class:'cat',text:'٤) صورة الألوان المولّدة 🖼️'}));
cImg.appendChild(el('div',{class:'mut',text:'صورة تُولَّد بالكانفس (Canvas): خلفية غامقة + شبكة دوائر بأكواد الألوان ورقم كل لون تحت دائرته، وتنزل مع رسالة البانل كصورة رئيسية. القائمة تحت الصورة أرقام فقط — العضو يشوف الرقم بالصورة ويختاره.'}));
var pv=el('img',{src:'/dashboard/api/colors/image.png?t='+Date.now(),style:'max-width:100%;border-radius:14px;margin:12px 0;border:1px solid #2a2836;background:#12101a'});
cImg.appendChild(pv);
cImg.appendChild(el('div',{class:'row'},[
  el('button',{class:'btn',text:'🖼️ إعادة توليد صورة الألوان وإرسالها',on:{click:function(){
    if(!c.roles.length)return toast('أضف ألوان أول',1);
    if(!c.channelId)return toast('حدّد روم قائمة الألوان واحفظ أول',1);
    api('colors/image',{resend:false}).then(function(){pv.src='/dashboard/api/colors/image.png?t='+Date.now();toast('تم توليد الصورة وإرسالها للبانل ✅');show('colors')}).catch(function(e){toast(e.message,1)})
  }}}),
  el('button',{class:'b2',text:'📨 توليد وإرسال برسالة جديدة',on:{click:function(){
    if(!c.channelId)return toast('حدّد روم قائمة الألوان واحفظ أول',1);
    if(!confirm('نرسل بانل جديد بالصورة (وتنحذف الرسالة القديمة)؟'))return;
    api('colors/image',{resend:true}).then(function(){pv.src='/dashboard/api/colors/image.png?t='+Date.now();toast('انرسل البانل الجديد مع الصورة ✅');show('colors')}).catch(function(e){toast(e.message,1)})
  }}}),
  el('button',{class:'b2',text:'🔄 تحديث المعاينة',on:{click:function(){pv.src='/dashboard/api/colors/image.png?t='+Date.now();toast('تحدّثت المعاينة ✅')}}})
]));
m.appendChild(cImg);

var sumEl=el('div',{class:'mut',style:'margin:8px 0',text:'جاري حساب عدد الأعضاء...'});
var c4=el('div',{class:'card'});
c4.appendChild(el('div',{class:'cat',text:'٥) 🚨 إزالة شاملة لكل الألوان'}));
c4.appendChild(el('div',{class:'mut',text:'تسحب كل رتب الألوان المضافة فوق من جميع أعضاء السيرفر بضغطة وحدة — مفيدة لو بغيت تعيد توزيع الألوان من جديد. الرتب نفسها تبقى بالسيرفر (ما تنحذف). العملية تشتغل بالخلفية وتشوف تقدمها تحت.'}));
c4.appendChild(sumEl);
var ok=sw(false,function(){});
c4.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:'أفهم إن العملية تسحب رتب الألوان من كل الأعضاء'}),ok]));
var bar=el('div',{class:'bar'},[el('i',{style:'width:0%'})]);
var st=el('div',{class:'mut',style:'margin:8px 0'});
var runBtn=el('button',{class:'dn',text:'🚨 إزالة الألوان من جميع الأعضاء',on:{click:function(){
  if(!c.roles.length)return toast('ما فيه ألوان مضافة',1);
  if(!ok.querySelector('input').checked)return toast('فعّل مربع التأكيد أول',1);
  if(!confirm('متأكد؟ الحين تنشال رتب الألوان من كل الأعضاء بالسيرفر.'))return;
  go(api('colors/clear',{confirm:true}),'بدأت الإزالة...',null);
  setTimeout(poll,1200);
}}});
c4.appendChild(el('div',{class:'row'},[runBtn]));
c4.appendChild(bar);c4.appendChild(st);
m.appendChild(c4);
function draw(j){
  if(!j||!j.startedAt){bar.querySelector('i').style.width='0%';st.textContent='ما فيه عملية إزالة شغالة';return}
  var pc=j.total?Math.round((j.scanned/j.total)*100):0;
  bar.querySelector('i').style.width=pc+'%';
  st.textContent=(j.running?'⏳ جارية الآن':'✅ خلصت')+' — فحصنا '+nf(j.scanned)+' من '+nf(j.total)+' عضو • شلنا '+nf(j.removed)+' لون من '+nf(j.touched)+' عضو'+(j.failed?' • فشل '+nf(j.failed):'')+(j.error?' • خطأ: '+j.error:'');
}
function poll(){api('colors/clear/status').then(function(x){draw(x.clear);if(x.clear&&x.clear.running)setTimeout(poll,1500)}).catch(function(){})}
draw(d.clear);
if(d.clear&&d.clear.running)poll();
api('colors/stats').then(function(s){c.roles.forEach(function(r){if(counts[r.id])counts[r.id].textContent=nf(s.roles[r.id]||0)+' عضو'});sumEl.textContent='عدد الأعضاء اللي شايلين لون حالياً: '+nf(s.withAny)+' من '+nf(s.members)}).catch(function(){sumEl.textContent='تعذر حساب عدد الأعضاء حالياً'});
return Promise.resolve()})};
pages.announce=function(m){return api('channels').then(function(d){m.appendChild(el('h1',{text:'الإعلانات'}));
var ch=el('select',{},d.channels.filter(function(c){return c.type==='text'}).map(function(c){return opt(c.id,'# '+c.name)})),t=el('input',{placeholder:'العنوان (اختياري)',style:'width:100%;margin:10px 0'}),x=el('textarea',{placeholder:'نص الإعلان'});
var img=sw(true,function(){});
m.appendChild(card('🖼️ شكل الإعلان',el('div',{class:'row'},[img,el('span',{class:'mut',text:'إرسال الإعلان كصورة مصممة (بطاقة نوفا)'})])));
m.appendChild(card('',el('div',{},[ch,t,x,el('div',{style:'margin-top:10px'},[el('button',{class:'btn',text:'إرسال الإعلان',on:{click:function(){go(api('announce',{channelId:ch.value,title:t.value,text:x.value,image:img.querySelector('input').checked}),'انرسل ✅')}}})])])))})};
// ===== 😍 الرياكشن: تفاعل تلقائي مع الصور برومات محددة =====
pages.react=function(m){return api('react').then(function(d){
 m.appendChild(el('h1',{text:'الرياكشن 😍'}));
 m.appendChild(el('div',{class:'mut',style:'line-height:1.9',text:'البوت يحط إيموجي على أي صورة تنزل بالرومات اللي تختارها — حتى ٣ إيموجيات. الرسائل النصية ما يلمسها، ويحترم حدود ديسكورد عشان ما ياخذ حظر.'}));
 var c=(d&&d.cfg)||{enabled:false,channels:[],emojis:['😍']};
 var chans=(d&&d.channels)||[];
 var can=(d&&d.can)||{view:true,react:true,history:true};
 var stat=(d&&d.stat)||{n:0,last:0};
 var st={enabled:!!c.enabled};
 var miss=[];if(!can.react)miss.push('إضافة تفاعلات');if(!can.view)miss.push('عرض الرومات');if(!can.history)miss.push('قراءة سجل الرسائل');
 m.appendChild(card('الحالة',el('div',{},[
  el('div',{class:'row'},[
   el('span',{class:'tag '+(c.enabled?'on':'off'),text:c.enabled?'✅ شغال':'⛔ مطفّي'}),
   el('span',{class:'tag',text:'📷 '+((c.channels||[]).length)+' روم'}),
   el('span',{class:'tag',text:'😍 '+((c.emojis||[]).join(' '))}),
   el('span',{class:'tag',text:'تفاعل مع '+((stat&&stat.n)||0)+' إيموجي'})
  ]),
  el('div',{class:'mut',style:'margin-top:8px',text:miss.length?('⚠️ البوت ناقصه صلاحيات: '+miss.join('، ')+' — لازم تعطيه إياها من صلاحيات رتبته.'):'✅ البوت عنده كل الصلاحيات المطلوبة.'})
 ])));
 m.appendChild(card('التشغيل',el('div',{class:'row'},[sw(st.enabled,function(v){st.enabled=v}),el('span',{text:'تشغيل الرياكشن التلقائي'})])));
 var sel=el('select',{multiple:'multiple',size:'10',style:'width:100%'},chans.map(function(x){return opt(x.id,'# '+x.name)}));
 [].forEach.call(sel.options,function(o){if((c.channels||[]).indexOf(o.value)>=0)o.selected=true});
 function pickCh(){var a=[];[].forEach.call(sel.options,function(o){if(o.selected)a.push(o.value)});return a}
 m.appendChild(card('📷 الرومات ('+chans.length+' روم متاح)',el('div',{},[
  el('div',{class:'mut',style:'margin-bottom:6px',text:'اختر روم واحد أو أكثر (Ctrl أو Shift للاختيار المتعدد).'}),
  sel,
  el('div',{class:'mut',style:'margin-top:6px;font-size:12px',text:'المختار حالياً: '+pickCh().length+' روم'})
 ])));
 var list=c.emojis||['😍'];
 var inputs=[0,1,2].map(function(i){
  return el('input',{value:list[i]||'',placeholder:i===0?'😍':'اختياري',style:'width:74px;text-align:center;font-size:22px;padding:6px'});
 });
 var quick=['😍','🔥','❤️','👏','😂','💯','😮','🥰'];
 var qrow=el('div',{class:'row',style:'gap:6px;flex-wrap:wrap;margin-top:8px'});
 quick.forEach(function(e){
  var b=el('button',{class:'b2',text:e,style:'font-size:18px;padding:4px 10px'});
  b.addEventListener('click',function(){
   var empty=null;for(var i=0;i<inputs.length;i++){if(!String(inputs[i].value||'').trim()){empty=inputs[i];break}}
   (empty||inputs[inputs.length-1]).value=e;
  });
  qrow.appendChild(b);
 });
 m.appendChild(card('😍 الإيموجيات (حتى ٣)',el('div',{},[
  el('div',{class:'row',style:'gap:8px'},inputs),
  qrow,
  el('div',{class:'mut',style:'margin-top:8px;font-size:12px',text:'تحط إيموجي عادي، أو إيموجي من رومات السيرفر بصيغة <:اسم:الآيدي>، أو آيدي إيموجي.'})
 ])));
 var saveBtn=el('button',{class:'btn',text:'💾 حفظ'});
 saveBtn.addEventListener('click',function(){
  var em=[];inputs.forEach(function(x){var v=String(x.value||'').trim();if(v&&em.indexOf(v)<0)em.push(v)});
  if(!em.length)return toast('حط إيموجي وحد على الأقل',1);
  saveBtn.disabled=true;
  api('react/save',{enabled:st.enabled,channels:pickCh(),emojis:em}).then(function(){
   toast('انحفظ ✅');show('react');
  }).catch(function(e){saveBtn.disabled=false;toast(e.message,1)});
 });
 var resetBtn=el('button',{class:'b2',text:'🔄 رجوع الافتراضي'});
 resetBtn.addEventListener('click',function(){resetBtn.disabled=true;api('react/reset',{}).then(function(){toast('رجع للافتراضي');show('react')}).catch(function(e){resetBtn.disabled=false;toast(e.message,1)})});
 m.appendChild(el('div',{class:'row',style:'margin-top:14px;gap:8px;flex-wrap:wrap'},[saveBtn,resetBtn]));
 return;
})}
pages.members=function(m){m.appendChild(el('h1',{text:'الأعضاء'}));
var q=el('input',{placeholder:'ابحث بالاسم',style:'flex:1;min-width:160px'}),box=el('div',{class:'card'});
function act(path,body,msg){go(api(path,body),msg,null);setTimeout(load,900)}
function load(){box.innerHTML='';box.appendChild(el('div',{class:'mut',text:'جاري البحث...'}));
api('members?q='+encodeURIComponent(q.value)).then(function(d){box.innerHTML='';if(!d.members.length)box.appendChild(el('div',{class:'mut',text:'ما لقيت أحد'}));
d.members.forEach(function(u){var k=[el('img',{src:u.avatar,width:'36',height:'36',style:'border-radius:50%'}),el('span',{class:'nm',text:u.name+(u.bot?' (بوت)':'')})];
u.roles.forEach(function(r){k.push(el('span',{class:'tag',text:r}))});
k.push(el('button',{class:'b2',text:'ميوت',on:{click:function(){var n=prompt('كم دقيقة؟ (0 لفك الميوت)','10');if(n!==null)act('members/timeout',{id:u.id,minutes:Number(n)},'تم ✅')}}}));
k.push(el('button',{class:'dn',text:'طرد',on:{click:function(){if(confirm('تأكيد طرد '+u.name+' ؟'))act('members/kick',{id:u.id,confirm:true},'تم الطرد')}}}));
k.push(el('button',{class:'dn',text:'حظر',on:{click:function(){if(confirm('تأكيد حظر '+u.name+' ؟'))act('members/ban',{id:u.id,confirm:true},'تم الحظر')}}}));
box.appendChild(el('div',{class:'item'},k))})}).catch(function(e){box.innerHTML='';box.appendChild(el('div',{class:'mut',text:e.message}))})}
m.appendChild(card('',row([q,el('button',{class:'btn',text:'بحث',on:{click:load}})])));m.appendChild(box);load();return Promise.resolve()};
pages.welcome=function(m){return api('welcome').then(function(d){var c=d.config;
m.appendChild(el('h1',{text:'الترحيب'}));m.appendChild(el('div',{class:'mut',text:'المتغيرات: {user} المنشن، {name} الاسم، {server} اسم السيرفر، {count} رقم العضو'}));
function lab(t,k){return el('label',{class:'row',style:'margin:10px 0'},[k,el('span',{text:t})])}
var en=el('input',{type:'checkbox'});en.checked=c.enabled;
var ch=el('select',{},[opt('','اختر روم الترحيب')].concat(d.channels.map(function(x){return opt(x.id,'# '+x.name)})));ch.value=c.channelId;
var ti=el('input',{style:'width:100%',value:c.title}),ms=el('textarea',{});ms.value=c.message;
var le=el('input',{type:'checkbox'});le.checked=c.leaveEnabled;var lm=el('input',{style:'width:100%',value:c.leaveMessage});
var rl=el('select',{},[opt('','بدون رتبة تلقائية')].concat(d.roles.map(function(x){return opt(x.id,x.name)})));rl.value=c.autoRoleId;
function body(){return{enabled:en.checked,channelId:ch.value,title:ti.value,message:ms.value,leaveEnabled:le.checked,leaveMessage:lm.value,autoRoleId:rl.value}}
m.appendChild(card('ترحيب الداخلين',el('div',{},[lab('تفعيل الترحيب',en),ch,el('p'),ti,el('p'),ms])));
m.appendChild(card('رسالة الوداع (نفس الروم)',el('div',{},[lab('تفعيل رسالة الوداع',le),lm])));
m.appendChild(card('رتبة تلقائية للداخلين',rl));
m.appendChild(row([el('button',{class:'btn',text:'حفظ',on:{click:function(){go(api('welcome/save',body()),'انحفظ ✅',null)}}}),
el('button',{class:'b2',text:'جرّب الترحيب',on:{click:function(){api('welcome/save',body()).then(function(){return api('welcome/test',{})}).then(function(){toast('انرسلت رسالة تجربة ✅')}).catch(function(e){toast(e.message,1)})}}})]));
var pv=el('img',{style:'width:100%;border-radius:14px;margin-top:12px;display:none'});
m.appendChild(card('صورة الترحيب 🖼️',el('div',{},[
el('div',{class:'mut',text:'هذي الصورة تنرسل مع كل ترحيب جديد: «ولكم» + صورة العضو + الاسم + الترتيب. السطر الذهبي تحت الاسم هو العنوان اللي فوق.'}),
el('p'),
row([el('button',{class:'b2',text:'🖼️ معاينة الصورة الآن',on:{click:function(){api('welcome/save',body()).then(function(){return api('welcome/preview')}).then(function(d){pv.src=d.image;pv.style.display='block';toast('هذي صورة ترحيبك ✅')}).catch(function(e){toast(e.message,1)})}}})]),
pv
])))})};
pages.tickets=function(m){return api('tickets').then(function(d){var c=d.config;
m.appendChild(el('h1',{text:'التذاكر'}));m.appendChild(el('div',{class:'mut',text:'التذاكر المفتوحة الآن: '+d.open+' • المتغير {user} في رسالة الترحيب يمنشن صاحب التذكرة'}));
function lab(t,k){return el('label',{class:'row',style:'margin:10px 0'},[k,el('span',{text:t})])}
function sel(first,list,val){var s=el('select',{},[opt('',first)].concat(list.map(function(x){return opt(x.id,x.name)})));s.value=val||'';return s}
var en=el('input',{type:'checkbox'});en.checked=c.enabled;
var cat=sel('بدون قسم (أنشئ الروم برا الأقسام)',d.categories,c.categoryId),st=sel('بدون رتبة دعم',d.roles,c.staffRoleId),lg=sel('بدون سجل',d.channels,c.logChannelId);
var pt=el('input',{style:'width:100%',value:c.panelTitle}),px=el('textarea',{}),bl=el('input',{style:'width:100%',value:c.buttonLabel}),wt=el('textarea',{}),mx=el('input',{type:'number',min:'1',max:'5',value:String(c.maxOpen)});
px.value=c.panelText;wt.value=c.welcomeText;
function body(){return{enabled:en.checked,categoryId:cat.value,staffRoleId:st.value,logChannelId:lg.value,panelTitle:pt.value,panelText:px.value,buttonLabel:bl.value,welcomeText:wt.value,maxOpen:mx.value}}
m.appendChild(card('الإعدادات',el('div',{},[lab('تفعيل نظام التذاكر',en),el('div',{class:'mut',text:'القسم اللي تنفتح فيه التذاكر'}),cat,el('p'),el('div',{class:'mut',text:'رتبة الدعم (تشوف كل التذاكر)'}),st,el('p'),el('div',{class:'mut',text:'روم سجل التذاكر (تنحفظ فيه نسخة المحادثة عند الإغلاق)'}),lg,el('p'),el('div',{class:'mut',text:'أقصى عدد تذاكر مفتوحة لكل عضو'}),mx])));
m.appendChild(card('شكل لوحة التذاكر',el('div',{},[pt,el('p'),px,el('p'),bl])));
m.appendChild(card('رسالة داخل التذكرة',wt));
var pc=sel('اختر الروم اللي تنرسل فيه اللوحة',d.channels,'');pc.firstChild.value='';
m.appendChild(row([el('button',{class:'btn',text:'حفظ',on:{click:function(){go(api('tickets/save',body()),'انحفظ ✅',null)}}})]));
m.appendChild(card('إرسال لوحة التذاكر',row([pc,el('button',{class:'b2',text:'أرسل اللوحة',on:{click:function(){if(!pc.value)return toast('اختر الروم أول',1);api('tickets/save',body()).then(function(){return api('tickets/panel',{channelId:pc.value})}).then(function(){toast('انرسلت اللوحة ✅')}).catch(function(e){toast(e.message,1)})}}})])))})};
pages.jail=function(m){return api('jail').then(function(d){var c=d.config;
m.appendChild(el('h1',{text:'السجن'}));
m.appendChild(el('div',{class:'mut',text:'رتبة وحدة تخفي كل الرومات عن صاحبها إلا روم السجن (شات وفويس). البوت يسحب رتب العضو الثانية وقت السجن ويرجعها وقت الإفراج تلقائياً، فقط تأكد رتبة البوت فوق رتبة السجن بترتيب الرتب عشان يقدر يضيفها ويشيلها.'}));
function sel(first,list,val){var s=el('select',{},[opt('',first)].concat(list.map(function(x){return opt(x.id,x.name)})));s.value=val||'';return s}
var en=el('input',{type:'checkbox'});en.checked=c.enabled;
var rl=sel('اختر رتبة السجن',d.roles,c.roleId);
var tc=sel('اختر روم شات السجن',d.channels,c.textChannelId);
var vc=sel('اختر روم فويس السجن',d.voiceChannels,c.voiceChannelId);
function lab(t,k){return el('label',{class:'row',style:'margin:10px 0'},[k,el('span',{text:t})])}
function body(){return{enabled:en.checked,roleId:rl.value,textChannelId:tc.value,voiceChannelId:vc.value}}
m.appendChild(card('الإعدادات',el('div',{},[lab('تفعيل نظام السجن',en),el('div',{class:'mut',text:'رتبة السجن'}),rl,el('p'),el('div',{class:'mut',text:'روم شات السجن'}),tc,el('p'),el('div',{class:'mut',text:'روم فويس السجن'}),vc])));
m.appendChild(row([el('button',{class:'btn',text:'حفظ',on:{click:function(){go(api('jail/save',body()),'انحفظ ✅',null)}}}),
el('button',{class:'b2',text:'🔄 مزامنة كل الرومات الآن',on:{click:function(){if(!confirm('بيتطبق منع الرؤية لرتبة السجن على كل رومات السيرفر الحالية، يكمل؟'))return;api('jail/save',body()).then(function(){return api('jail/sync',{})}).then(function(r){toast('تمت المزامنة: '+r.ok+'/'+r.total+' روم ✅')}).catch(function(e){toast(e.message,1)})}}})]));
m.appendChild(el('div',{class:'mut',style:'margin-top:10px',text:'أي روم جديد تسويه بعدين ينزامن تلقائياً، ما يحتاج تضغط مزامنة من جديد.'}))})};
pages.trap=function(m){return api('trap').then(function(d){var c=d.config;
m.appendChild(el('h1',{text:'روم الفخ'}));
m.appendChild(el('div',{class:'mut',text:'أي حد يكتب برّوم معين (غير المستثنيين بالآيدي تحت) ينحظر تلقائي فوراً. فعّال ضد بوتات السبام/الراقات اللي تكتب بكل روم تشوفه. ارثر وإيدا والرتبة الملكية محميين دايماً تلقائياً.'}));
m.appendChild(el('div',{class:'mut',style:'margin-top:6px;color:#7fe0a5',text:'🔒 نظام الحظر التلقائي مستقل تماماً عن "التحكم بالبوت": يشتغل حتى لو الروم معطّل أو خارج القائمة المسموح فيها، وتغيير رومات البوت التفاعلية ما يوقفه أو ينفكه.'}));
function sel(first,list,val){var s=el('select',{},[opt('',first)].concat(list.map(function(x){return opt(x.id,x.name)})));s.value=val||'';return s}
var en=el('input',{type:'checkbox'});en.checked=c.enabled;
var tc=sel('اختر روم الفخ',d.channels,c.channelId);
var ex=el('textarea',{placeholder:'آيدي كل عضو أو بوت مستثنى، كل وحد بسطر لحاله'});ex.value=(c.exemptIds||[]).join('\\n');
function lab(t,k){return el('label',{class:'row',style:'margin:10px 0'},[k,el('span',{text:t})])}
m.appendChild(card('الإعدادات',el('div',{},[lab('تفعيل روم الفخ',en),el('div',{class:'mut',text:'روم الفخ'}),tc,el('p'),el('div',{class:'mut',text:'آيديات مستثناة (بوتات ثانية عندك مثلاً)'}),ex])));
m.appendChild(row([el('button',{class:'btn',text:'حفظ',on:{click:function(){api('trap/save',{enabled:en.checked,channelId:tc.value,exemptIdsText:ex.value}).then(function(){toast('انحفظ ✅')}).catch(function(e){toast(e.message,1)})}}})]))})};
// ===== حالة البوت (Presence) =====
pages.presence=function(m){return api('presence').then(function(d){var c=d.config,st=d.state||{};
m.appendChild(el('h1',{text:'حالة البوت'}));
m.appendChild(el('div',{class:'mut',text:'هنا تضبط «وش يبيّن العبد» على ديسكورد: حالات دوّارة تتبدّل لحالها (يلعب · يشاهد · يستمع · ينافس · يبث) + حالات ديناميكية بأرقام حقيقية (عدد الأعضاء · مدة الصمود) + مرآة نشاط الملكيين (لو ارثر أو إيدا يلعب شي، تطلع حالته على البوت).'}));
function inp(v,mn,mx,w){var i=el('input',{type:'number',min:String(mn),max:String(mx),style:'width:'+(w||88)+'px'});i.value=String(v);return i}
function fld(t,elm){return el('div',{style:'margin:6px 10px 6px 0'},[el('div',{class:'mut',text:t}),elm])}
function sel(first,list,val){var s=el('select',{},[opt('',first)].concat(list.map(function(x){return opt(x.id,x.name)})));s.value=val||'';return s}
var TYPES=[['play','🎮 يلعب'],['watch','👀 يشاهد'],['listen','🎧 يستمع إلى'],['compete','🏆 ينافس في'],['stream','🔴 يبث (يحتاج رابط)']];
var s={enabled:!!c.enabled,dyn:!!c.dynamic,mir:!!c.mirror};
function tgl(k,t){return el('div',{class:'row',style:'margin:10px 0'},[sw(s[k],function(v){s[k]=v}),el('span',{text:t})])}
var iv=inp(c.intervalSec,30,3600);
var sts=el('select',{},[opt('online','🟢 متصل'),opt('idle','🌙 خامل'),opt('dnd','⛔ لا تزعجوني'),opt('invisible','👻 غير ظاهر')]);sts.value=c.status;
var an=sel('بدون روم (ما ننشر)',d.channels,c.announceId);
var mu=el('textarea',{placeholder:'آيدي كل حساب نعكس نشاطه، كل وحد بسطر (اتركه فاضي = ارثر وإيدا والرتبة الملكية)'});mu.value=(c.mirrorUsers||[]).join('\\n');
var mm=inp(c.mirrorMinutes,1,240);
var items=(c.items||[]).map(function(x){return{name:String(x.name||''),type:String(x.type||'play'),url:String(x.url||'')}});
var box=el('div',{});
function render(){
 box.textContent='';
 items.forEach(function(it,i){
  var ni=el('input',{type:'text',style:'flex:1;min-width:180px'});ni.value=it.name;
  ni.oninput=function(){it.name=ni.value};
  var ti=el('select',{},TYPES.map(function(t){return opt(t[0],t[1])}));ti.value=it.type;
  ti.onchange=function(){it.type=ti.value;render()};
  var ui=el('input',{type:'text',style:'min-width:150px',placeholder:'رابط البث (twitch.tv/...)'});ui.value=it.url;
  ui.oninput=function(){it.url=ui.value};
  var r=el('div',{class:'row',style:'display:flex;gap:6px;align-items:center;margin:6px 0'},[
   ni,ti,
   el('button',{class:'b2',text:'▲',on:{click:function(){if(i>0){var x=items[i-1];items[i-1]=items[i];items[i]=x;render()}}}}),
   el('button',{class:'b2',text:'▼',on:{click:function(){if(i<items.length-1){var x=items[i+1];items[i+1]=items[i];items[i]=x;render()}}}}),
   el('button',{class:'b2',text:'🗑️',on:{click:function(){items.splice(i,1);render()}}})
  ]);
  if(it.type==='stream')r.appendChild(ui);
  box.appendChild(r);
 });
 if(!items.length)box.appendChild(el('div',{class:'mut',text:'ما فيه حالات — اضغط «➕ إضافة حالة»'}));
}
render();
function body(){var o={enabled:s.enabled,status:sts.value,intervalSec:iv.value,dynamic:s.dyn,mirror:s.mir,announceId:an.value,mirrorMinutes:mm.value,mirrorUsersText:mu.value};o.items=items.map(function(x){return{name:x.name,type:x.type,url:x.url}});return o}
m.appendChild(card('الحالة الآن',el('div',{},[
 el('div',{class:'row'},[el('span',{class:'tag '+(st.enabled?'on':'off'),text:st.enabled?'✅ الحالة شغالة':'⛔ الحالة مطفية'}),el('span',{class:'tag',text:'يبيّن: '+((st.now&&st.now.text)||'—')}),el('span',{class:'tag',text:'المصدر: '+((st.now&&st.now.source)||'—')})]),
 el('div',{class:'mut',style:'margin-top:8px',text:'عدد الحالات: '+(st.total||0)+' — التبديل كل '+c.intervalSec+' ثانية'+(st.mirrorNow?(' · 🪞 ماسك حالة: '+st.mirrorHold):'')}),
 el('div',{class:'mut',text:st.mirrorCapable?'✅ المرآة جاهزة (Presence Intent مفعّل عند ديسكورد).':'⚠️ Presence Intent مو مفعّل — المرآة ما بتشتغل (باقي الحالات شغالة). فعّله من Discord Developer Portal ← Bot ← Presence Intent.'}),
 el('div',{class:'mut',text:'آخر تحديث: '+((st.now&&st.now.at)?new Date(st.now.at).toLocaleTimeString('ar-OM'):'—')})
])));
m.appendChild(card('الإعدادات الأساسية',el('div',{},[
 tgl('enabled','تفعيل الحالة الدوّارة'),
 tgl('dyn','حالات ديناميكية (عدد الأعضاء · مدة الصمود · الوقت)'),
 tgl('mir','مرآة نشاط الملكيين (يحتاج Presence Intent)'),
 el('div',{class:'row'},[fld('التبديل كل (ثانية)',iv),fld('حالة الحساب',sts),fld('مدة مسك حالة الشخص (دقيقة)',mm)]),
 el('p'),el('div',{class:'mut',text:'روم إعلانات النشاط (اختياري — ينشر «فلان بدأ يلعب …») '}),an
])));
m.appendChild(card('قائمة الحالات',el('div',{},[
 el('div',{class:'mut',text:'كل حالة تطلع بالدور. اكتب النص كما تبيه يظهر على ديسكورد.'}),
 box,
 el('div',{class:'row'},[el('button',{class:'b2',text:'➕ إضافة حالة',on:{click:function(){items.push({name:'حالة جديدة',type:'play',url:''});render()}}})])
])));
m.appendChild(card('مرآة النشاط — من نقلّد؟',el('div',{},[
 el('div',{class:'mut',text:'اترك الفراغ = ارثر وإيدا وأي عضو بالرتبة الملكية. أو اكتب آيديات محددة (كل آيدي بسطر).'}),
 mu
])));
m.appendChild(row([
 el('button',{class:'btn',text:'💾 حفظ كل الإعدادات',on:{click:function(){go(api('presence/save',body()),'انحفظت حالة البوت ✅','presence')}}}),
 el('button',{class:'b2',text:'🎮 طبّق الحالة الآن',on:{click:function(){go(api('presence/apply',{}),'انطبقت الحالة 🎮','presence')}}}),
 el('button',{class:'b2',text:'🔄 رجوع الافتراضي',on:{click:function(){if(!confirm('نرجّع حالات البوت للافتراضي؟'))return;go(api('presence/reset',{}),'رجعنا الافتراضي','presence')}}})
]));
})};
// ===== 🎛️ لوحة التحكم (رسالة وحدة فيها بانر + خيارات) =====
pages.hub=function(m){return api('hub').then(function(d){var c=d.config,st=d.state||{};
m.appendChild(el('h1',{text:'لوحة التحكم'}));
m.appendChild(el('div',{class:'mut',text:'لوحة زي لوحات السيرفرات الكبيرة: رسالة وحدة فيها صورة بانر مصممة بهوية نوفا + قائمة خيارات، والعضو يختار الخيار فيصير له شي فعلي (تذكرة · بطاقته · راتبه اليومي · القرعات · لونه · رتبته · القوانين · رسالة للإدارة). كل خيار مربوط بنظام حقيقي بالبوت — ما فيه شي وهمي. تقدر ترسلها بأمر /لوحة_تحكم من أي روم (للملكيين) أو من الأزرار تحت.'}));
function fld(t,e){return el('div',{style:'margin:6px 10px 6px 0'},[el('div',{class:'mut',text:t}),e])}
var chs=el('select',{style:'flex:1;min-width:210px'},[opt('','— اختر روم —')].concat(d.channels.map(function(x){return opt(x.id,x.name)})));chs.value=c.channelId||'';
var cts=el('select',{style:'flex:1;min-width:210px'},[opt('','— بدون روم (تواصل بالخاص) —')].concat(d.channels.map(function(x){return opt(x.id,x.name)})));cts.value=c.contactId||'';
var S={enabled:!!c.enabled,image:c.image!==false};
var en=sw(S.enabled,function(v){S.enabled=v});
var im=sw(S.image,function(v){S.image=v});
var ti=el('input',{type:'text',placeholder:'العنوان الكبير بالبانر — مثال: لوحة التحكم',style:'flex:1;min-width:190px'});ti.value=c.title||'';
var sub=el('input',{type:'text',placeholder:'CONTROL PANEL',style:'flex:1;min-width:150px'});sub.value=c.subtitle||'';
var pl=el('input',{type:'text',placeholder:'نص القائمة قبل ما يفتحها العضو',style:'flex:1;min-width:210px'});pl.value=c.placeholder||'';
var hd=el('input',{type:'text',placeholder:'عنوان الرسالة (Embed)',style:'flex:1;min-width:210px'});hd.value=c.heading||'';
var de=el('textarea',{placeholder:'وصف الرسالة'});de.value=c.desc||'';
var co=el('input',{type:'color',value:'#'+(c.color||'b3121e')});
var ru=el('textarea',{style:'min-height:120px',placeholder:'نص القوانين (يطلع لمن يضغط خيار القوانين)'});ru.value=c.rules||'';
var sr=el('textarea',{style:'min-height:90px',placeholder:'آيدي الرتبة : اسم الزر — كل رتبة بسطر\\nمثال:\\n123456789012345678 : 🎮 قيمر'});sr.value=c.selfRolesText||'';
var opts=(c.options||[]).map(function(o){return{id:o.id,on:o.on!==false,emoji:o.emoji||'',label:String(o.label||''),desc:String(o.desc||'')}});
var box=el('div',{});
function render(){
 box.textContent='';
 opts.forEach(function(o,i){
  var t=sw(o.on!==false,function(v){o.on=v});
  var ei=el('input',{type:'text',style:'width:64px',placeholder:'إيموجي'});ei.value=o.emoji;ei.oninput=function(){o.emoji=ei.value};
  var li=el('input',{type:'text',style:'flex:1;min-width:180px'});li.value=o.label;li.oninput=function(){o.label=li.value};
  var di=el('input',{type:'text',style:'flex:1;min-width:170px',placeholder:'وصف صغير تحت الاسم'});di.value=o.desc;di.oninput=function(){o.desc=di.value};
  box.appendChild(el('div',{class:'row',style:'display:flex;gap:6px;align-items:center;margin:6px 0'},[
   t,ei,li,di,
   el('button',{class:'b2',text:'▲',on:{click:function(){if(i>0){var x=opts[i-1];opts[i-1]=opts[i];opts[i]=x;render()}}}}),
   el('button',{class:'b2',text:'▼',on:{click:function(){if(i<opts.length-1){var x=opts[i+1];opts[i+1]=opts[i];opts[i]=x;render()}}}})
  ]));
 });
 if(!opts.length)box.appendChild(el('div',{class:'mut',text:'ما فيه خيارات — اضغط «🔄 رجوع الافتراضي».'}));
}
render();
function body(){var o={enabled:S.enabled,image:S.image,channelId:chs.value,contactId:cts.value,title:ti.value,subtitle:sub.value,placeholder:pl.value,heading:hd.value,desc:de.value,color:co.value.replace('#',''),rules:ru.value,selfRolesText:sr.value};
 o.options=opts.map(function(x){return{id:x.id,on:x.on!==false,emoji:x.emoji,label:x.label,desc:x.desc}});return o}
var live=opts.filter(function(o){return o.on!==false}).length;
m.appendChild(card('حالة اللوحة',el('div',{},[
 el('div',{class:'row'},[
  el('span',{class:'tag '+(st.enabled?'on':'off'),text:st.enabled?'✅ مفعّلة':'⛔ مطفية'}),
  el('span',{class:'tag',text:'الروم: '+(c.channelId?('<#'+c.channelId+'>'):'ما تحدد')}),
  el('span',{class:'tag',text:c.messageId?'الرسالة مرسلة ومربوطة ✅':'ما فيه رسالة مرسلة'}),
  el('span',{class:'tag',text:'خيارات شغالة: '+live})
 ]),
 el('div',{class:'mut',style:'margin-top:8px',text:'لما تكون «مفعّلة» البوت يتأكد من الرسالة عند كل إقلاع ويحدّثها، ولو انحذفت يرسلها من جديد.'}),
 st.link?el('div',{class:'mut',style:'margin-top:6px'},[el('a',{href:st.link,target:'_blank',text:'🔗 افتح رسالة اللوحة بديسكورد'})]):null,
 el('img',{src:'/dashboard/api/hub/image.png?t='+Date.now(),style:'max-width:100%;border-radius:14px;margin:12px 0;border:1px solid #2a2836;background:#12101a',on:{error:function(){this.style.display='none';if(this.nextSibling)this.nextSibling.style.display='block'}}}),
 el('div',{class:'mut',style:'display:none;margin:8px 0;color:#ff9b9b',text:'⚠️ ما قدرت أعرض البانر — تأكد أن ملف art.js المحدّث (فيه panelCard) مرفوع للسيرفر.'})
])));
m.appendChild(card('الإعدادات الأساسية',el('div',{},[
 el('div',{class:'row',style:'margin:10px 0'},[en,el('span',{text:'تفعيل اللوحة (تحديث تلقائي + إعادة إرسال لو انحذفت)'})]),
 el('div',{class:'row',style:'margin:10px 0'},[im,el('span',{text:'إرسال البانر المصمم كصورة (لو طفيتها تنرسل نص عادي أخف)'})]),
 el('div',{class:'row'},[fld('روم اللوحة',chs),fld('روم تواصل الإدارة (اختياري)',cts),fld('لون الرسالة',co)]),
 el('div',{class:'row'},[fld('العنوان بالبانر',ti),fld('السطر الإنجليزي',sub)]),
 el('div',{class:'row'},[fld('عنوان الرسالة',hd)]),
 el('div',{class:'row'},[fld('نص القائمة',pl)]),
 el('div',{style:'margin:10px 0'},[el('div',{class:'mut',text:'وصف الرسالة'}),de])
])));
m.appendChild(card('الخيارات (شكلها بالضبط مثل ما بتنزل بالرسالة)',el('div',{},[
 el('div',{class:'mut',text:'كل سطر = خيار بالقائمة: المفتاح يفعّله/يطفيه، الإيموجي أول مربع، الاسم، والوصف اللي يطلع تحت الاسم. ▲▼ يغيّرون الترتيب.'}),
 box,
 el('div',{class:'row'},[
  el('button',{class:'b2',text:'➕ رجوع للخيارات الافتراضية',on:{click:function(){opts=(d.defaults.options||[]).map(function(o){return{id:o.id,on:o.on!==false,emoji:o.emoji||'',label:o.label||'',desc:o.desc||''}});render();toast('رجعت الخيارات للافتراضي — لا تنسى الحفظ 💾')}}}),
  el('button',{class:'b2',text:'✅ تفعيل الكل',on:{click:function(){opts.forEach(function(o){o.on=true});render()}}}),
  el('button',{class:'b2',text:'⛔ إطفاء الكل',on:{click:function(){opts.forEach(function(o){o.on=false});render()}}})
 ])
])));
m.appendChild(card('نص القوانين 📜',el('div',{},[
 el('div',{class:'mut',text:'يطلع للعضو لما يختار خيار القوانين (رد خاص له هو فقط).'}),
 ru
])));
m.appendChild(card('الرتب الذاتية 📢',el('div',{},[
 el('div',{class:'mut',text:'اكتب «آيدي الرتبة : اسم الزر» كل رتبة بسطر، والعضو يضغط الزر فياخذ الرتبة أو تنشال عنه. (نفس أزرار /رتب_لوحة)'}),
 sr
])));
m.appendChild(row([
 el('button',{class:'btn',text:'💾 حفظ كل الإعدادات',on:{click:function(){go(api('hub/save',body()),'انحفظت لوحة التحكم ✅','hub')}}}),
 el('button',{class:'b2',text:'📨 إرسال/تحديث اللوحة',on:{click:function(){if(!chs.value)return toast('حدّد الروم واحفظ أول',1);go(api('hub/send',{resend:false}),'انرسلت/انحدّثت اللوحة ✅','hub')}}}),
 el('button',{class:'b2',text:'📨 رسالة جديدة (يحذف القديمة)',on:{click:function(){if(!chs.value)return toast('حدّد الروم واحفظ أول',1);if(!confirm('نرسل لوحة جديدة ونحذف الرسالة القديمة؟'))return;go(api('hub/send',{resend:true}),'انرسلت لوحة جديدة ✅','hub')}}}),
 el('button',{class:'b2',text:'🖼️ تحديث معاينة البانر',on:{click:function(){show('hub');toast('تحدّثت المعاينة 🖼️')}}}),
 el('button',{class:'b2',text:'🔄 رجوع الافتراضي',on:{click:function(){if(!confirm('نرجّع لوحة التحكم للافتراضي (وتنطفي)؟'))return;go(api('hub/reset',{}),'رجعنا الافتراضي','hub')}}})
]));
})};
// ===== الحماية (درع نوفا) =====
pages.guard=function(m){return api('guard').then(function(d){var c=d.config,cap=d.caps||{};
m.appendChild(el('h1',{text:'الحماية'}));
m.appendChild(el('div',{class:'mut',text:'درع نوفا: حماية سيرفرك من النك والاختراق — حذف الرومات والرتب بالجملة، حظر أو طرد الأعضاء بالجملة، إعطاء رتب خطيرة لأي أحد، تخريب الصلاحيات، الويب هوكس، الإيموجي والدعوات، الرايد، والسبام. يعاقب المخرب ويرجّع اللي انخرب تلقائياً.'}));
function inp(v,mn,mx,w){var i=el('input',{type:'number',min:String(mn),max:String(mx),style:'width:'+(w||88)+'px'});i.value=String(v);return i}
function fld(t,elm){return el('div',{style:'margin:6px 10px 6px 0'},[el('div',{class:'mut',text:t}),elm])}
function sel(first,list,val){var s=el('select',{},[opt('',first)].concat(list.map(function(x){return opt(x.id,x.name)})));s.value=val||'';return s}
var st={enabled:!!c.enabled,revert:!!c.revert,strict:!!c.strictAll,po:!!c.protectOwners,pb:!!c.punishBots,dm:!!c.alertDM,raid:!!c.raid.enabled,kickNew:!!c.raid.kickNew,spam:!!c.spam.enabled};
function tgl(k,t){return el('div',{class:'row',style:'margin:10px 0'},[sw(st[k],function(v){st[k]=v}),el('span',{text:t})])}
var mode=el('select',{},[opt('ban','🚫 حظر فوري'),opt('kick','👢 طرد فوري'),opt('derole','🎭 سحب كل رتبه')]);mode.value=c.mode;
var ac=sel('بدون روم (تنبيه بالخاص فقط)',d.channels,c.alertChannelId);
var au=el('textarea',{placeholder:'آيدي أي حساب ثاني ينرسل له التنبيه بالخاص، كل وحد بسطر (مثلاً حسابك)'});au.value=(c.alertUsers||[]).join('\\n');
var win=inp(c.windowSec,3,120),L=c.limits;
var Lc={cd:inp(L.channelDelete,1,50),cc:inp(L.channelCreate,1,50),rd:inp(L.roleDelete,1,50),rc:inp(L.roleCreate,1,50),ru:inp(L.roleUpdate,1,50),bn:inp(L.ban,1,50),kk:inp(L.kick,1,50),wh:inp(L.webhook,1,50),em:inp(L.emoji,1,50),iv:inp(L.invite,1,50),ow:inp(L.overwrite,1,50)};
var us=el('textarea',{placeholder:'آيدي كل عضو مستثنى، كل وحد بسطر'});us.value=(c.whitelist.users||[]).join('\\n');
var bs=el('textarea',{placeholder:'آيدي كل بوت موثوق، كل وحد بسطر'});bs.value=(c.whitelist.bots||[]).join('\\n');
var rs=el('select',{multiple:'multiple',size:'6'},(d.roles||[]).map(function(r){return opt(r.id,r.name)}));
[].forEach.call(rs.options,function(o){if((c.whitelist.roles||[]).indexOf(o.value)>=0)o.selected=true});
function pickRoles(){var a=[];[].forEach.call(rs.options,function(o){if(o.selected)a.push(o.value)});return a}
var rj=inp(c.raid.joins,2,100),rsx=inp(c.raid.sec,3,600),rmd=inp(c.raid.minDays,0,365),rau=inp(c.raid.autoUnlockMin,0,1440);
var sm=inp(c.spam.msgs,3,60),ss=inp(c.spam.sec,2,60),sd=inp(c.spam.dupMsgs,2,20),sn=inp(c.spam.mentions,3,50),stm=inp(c.spam.timeoutMin,1,1440);
function body(){return{enabled:st.enabled,mode:mode.value,revert:st.revert,strictAll:st.strict,protectOwners:st.po,punishBots:st.pb,alertDM:st.dm,alertChannelId:ac.value,windowSec:win.value,
limits:{channelDelete:Lc.cd.value,channelCreate:Lc.cc.value,roleDelete:Lc.rd.value,roleCreate:Lc.rc.value,roleUpdate:Lc.ru.value,ban:Lc.bn.value,kick:Lc.kk.value,webhook:Lc.wh.value,emoji:Lc.em.value,invite:Lc.iv.value,overwrite:Lc.ow.value},
usersText:us.value,botsText:bs.value,roleIds:pickRoles(),alertUsersText:au.value,
raidEnabled:st.raid,joins:rj.value,raidSec:rsx.value,minDays:rmd.value,kickNew:st.kickNew,autoUnlockMin:rau.value,
spamEnabled:st.spam,spamMsgs:sm.value,spamSec:ss.value,dupMsgs:sd.value,mentions:sn.value,timeoutMin:stm.value}}
// ١) الحالة والقفل
var miss=[];if(!cap.ban)miss.push('حظر الأعضاء');if(!cap.manageRoles)miss.push('إدارة الرتب');if(!cap.manageChannels)miss.push('إدارة الرومات');if(!cap.audit)miss.push('عرض سجل التدقيق');
m.appendChild(card('حالة السيرفر',el('div',{},[
 el('div',{class:'row'},[el('span',{class:'tag '+(c.enabled?'on':'off'),text:c.enabled?'✅ الحماية شغالة':'⛔ الحماية مطفية'}),el('span',{class:'tag '+(d.locked?'off':'on'),text:d.locked?'🔒 السيرفر مقفول':'🔓 السيرفر مفتوح'}),el('span',{class:'tag',text:'العقوبة: '+(c.mode==='ban'?'حظر':c.mode==='kick'?'طرد':'سحب الرتب')})]),
 el('div',{class:'mut',style:'margin-top:8px',text:miss.length?('⚠️ البوت ناقصه صلاحيات: '+miss.join('، ')+' — لازم تعطيه إياها من صلاحيات رتبته.'):'✅ البوت عنده كل الصلاحيات المطلوبة (حظر، إدارة رتب، إدارة رومات، سجل التدقيق).'}),
 el('div',{class:'mut',text:'ترتيب رتبة البوت: '+cap.highest+' من '+cap.total+' — لازم رتبته فوق رتبة أي مخرب عشان يقدر يعاقبه.'})
])));
m.appendChild(row([
 el('button',{class:'b2',text:'🔒 قفل السيرفر فوراً',on:{click:function(){if(!confirm('نقفل كل الرومات فوراً؟ ما يقدر أحد يكتب غير الملكيين.'))return;go(api('guard/lock',{on:true,confirm:true}),'انقفل السيرفر 🔒 🛡️','guard')}}}),
 el('button',{class:'b2',text:'🔓 فتح السيرفر',on:{click:function(){go(api('guard/lock',{on:false,confirm:true}),'انفتح السيرفر 🔓 🛡️','guard')}}}),
 el('button',{class:'b2',text:'🧪 تجربة التنبيه',on:{click:function(){
  toast('جاري إرسال التنبيه…');
  api('guard/test',{}).then(function(r){var p=(r&&r.report)||{};
   var t=['🧪 نتيجة تجربة التنبيه:','','• البطاقة: '+(p.art?'🖼️ صورة مصممة':'📝 نص عادي'+(p.artNote?' ('+p.artNote+')':'')),'• روم التنبيهات: '+(p.channel||'—'),'• الرسالة الخاصة: '+(p.dm||'—'),'• سجل التدقيق: '+(p.audit||'—'),'• صلاحيات البوت: '+(p.perms||'—'),'','(هذي النافذة تطلع لك دايماً بعد كل تجربة — صورها وابعثها لو فيه مشكلة)'].join('\\n');
   var bx=document.getElementById('gtesterr');if(bx)bx.textContent=t;
   alert(t);
  }).catch(function(e){toast(e.message,1);alert('⛔ فشل طلب التجربة: '+e.message)})}}}),
 el('button',{class:'b2',text:'🧹 تصفير الحوادث',on:{click:function(){if(!confirm('نمسح كل سجل الحوادث؟'))return;go(api('guard/clear',{}),'انمسح السجل ✅','guard')}}})
]));
m.appendChild(el('div',{class:'mut',id:'gtesterr',style:'white-space:pre-line;margin-top:8px'}));
// ٢) الإعدادات
m.appendChild(card('الإعدادات الأساسية',el('div',{},[
 tgl('enabled','تفعيل درع نوفا (الحماية كلها)'),
 tgl('revert','إرجاع اللي انخرب تلقائياً (رومات/رتب/حظر/صلاحيات)'),
 tgl('strict','أقصى حماية: عاقب حتى على تغيير الصلاحيات وإعطاء الرتب'),
 tgl('po','حماية حتى الملكيين وارثر وإيدا (لما حسابك ينخترق)'),
 tgl('pb','عاقب البوتات الثانية مثل الأعضاء (بوتات النك)'),
 tgl('dm','أرسل التنبيه برسالة خاصة للملكي'),
 el('div',{class:'mut',style:'margin-top:8px',text:'العقوبة الافتراضية عند التخريب الجماعي'}),mode,
 el('p'),el('div',{class:'mut',text:'روم التنبيهات (يستحسن روم خاص للملكية)'}),ac,
 el('p'),el('div',{class:'mut',text:'آيديات إضافية للتنبيه بالخاص (اختياري — لو تبي التنبيه يوصل لحساب ثاني غير ارثر وإيدا)'}),au,
 el('p'),el('div',{class:'mut',text:'نافذة العدّ بالثواني (نحسب التكرار خلالها)'}),win
])));
// ٣) حدود التخريب
m.appendChild(card('حدود التخريب (عدد الحركات اللي بعدها نعتبره مخرب)',el('div',{},[
 el('div',{class:'row'},[fld('حذف رومات',Lc.cd),fld('إنشاء رومات',Lc.cc),fld('حذف رتب',Lc.rd),fld('إنشاء رتب',Lc.rc),fld('تعديل رتب',Lc.ru),fld('حظر أعضاء',Lc.bn)]),
 el('div',{class:'row'},[fld('طرد أعضاء',Lc.kk),fld('ويب هوكس',Lc.wh),fld('حذف إيموجي',Lc.em),fld('إنشاء دعوات',Lc.iv),fld('تخريب صلاحيات',Lc.ow)]),
 el('div',{class:'mut',text:'أي إعطاء لصلاحية خطيرة (Administrator/إدارة الرتب/الحظر…) يُرصد فوراً ولو حركة وحدة — حتى لو أعطاها أدمن.'})
])));
// ٤) المستثنون
m.appendChild(card('المستثنون (ما تنطبق عليهم الحماية)',el('div',{},[
 el('div',{class:'mut',text:'ارثر وإيدا والرتبة الملكية وصاحب السيرفر محميين دايماً تلقائياً (إلا لو فعّلت «حماية حتى الملكيين»).'}),
 el('div',{class:'mut',style:'margin-top:8px',text:'آيديات أعضاء مستثنين'}),us,
 el('p'),el('div',{class:'mut',text:'آيديات بوتات موثوقة'}),bs,
 el('p'),el('div',{class:'mut',text:'رتب مستثناة (اضغط Ctrl لاختيار أكثر من وحدة)'}),rs
])));
// ٥) الرايد
m.appendChild(card('مقاومة الرايد (دخول أعضاء بالجملة)',el('div',{},[
 tgl('raid','تفعيل مقاومة الرايد'),
 el('div',{class:'row'},[fld('عدد الداخلين',rj),fld('خلال (ثانية)',rsx),fld('أقل عمر حساب (يوم)',rmd),fld('فتح تلقائي بعد (دقيقة)',rau)]),
 tgl('kickNew','اطرد الحسابات الجديدة فوراً (حماية استباقية)'),
 el('div',{class:'mut',text:'لما يدخلون أكثر من العدد خلال المدة: يقفل السيرفر فوراً ويرسل تنبيه، ويفتح تلقائياً بعد المدة (صفر = يقفل لين تفتحه بنفسك).'})
])));
// ٦) السبام
m.appendChild(card('مقاومة السبام',el('div',{},[
 tgl('spam','تفعيل مقاومة السبام'),
 el('div',{class:'row'},[fld('عدد الرسائل',sm),fld('خلال (ثانية)',ss),fld('تكرار نفس الرسالة',sd),fld('حد المنشن',sn),fld('مدة الكتم (دقيقة)',stm)]),
 el('div',{class:'mut',text:'السبام والتكرار والمنشن الجماعي = حذف الرسائل + كتم. ومنشن @everyone من غير الملكيين = حذف الرسالة فوراً.'})
])));
// ٧) حوادث
var inc=d.incidents||[],incBox=el('div',{});
if(!inc.length)incBox.appendChild(el('div',{class:'mut',text:'ما فيه أي محاولة تخريب مسجّلة ✅ سيرفرك نظيف.'}));
inc.forEach(function(l){incBox.appendChild(el('div',{class:'item'},[
 el('span',{class:'nm',text:(l.name||l.uid)+''}),
 el('span',{class:'tag',text:l.type==='ban'?'حظر بالجملة':l.type==='channelDelete'?'حذف رومات':l.type==='roleDelete'?'حذف رتب':l.type==='kick'?'طرد بالجملة':l.type==='raid'?'رايد':l.type==='spam'?'سبام':l.type==='roleGrant'?'رتبة خطيرة':l.type==='everyonePerm'?'صلاحيات @everyone':l.type}),
 el('span',{class:'mut',text:(l.detail||'')+' • '+(l.undone?'رجعنا '+l.undone+' • ':'')+(l.action||'')+' • '+new Date(l.at).toLocaleString('ar')})
]))});
m.appendChild(card('آخر محاولات التخريب',incBox));
// ٨) حفظ
m.appendChild(row([
 el('button',{class:'btn',text:'💾 حفظ كل الإعدادات',on:{click:function(){go(api('guard/save',body()),'انحفظ ✅ 🛡️','guard')}}}),
 el('button',{class:'b2',text:'🔄 رجّع الافتراضي',on:{click:function(){if(!confirm('نرجّع كل الإعدادات للافتراضي؟ (ما يأثر على المستثنين)'))return;go(api('guard/reset',{}),'رجعنا الافتراضي ✅','guard')}}})
]));
return Promise.resolve()})};
pages.bans=function(m){return api('bans').then(function(d){
m.appendChild(el('h1',{text:'المحظورين'}));
m.appendChild(el('div',{class:'mut',text:'كل المحظورين بالسيرفر من أي مصدر. اللي انحظر من روم الفخ عليه وسم 🪤. تقدر تفك الحظر مباشرة من هنا.'}));
var box=el('div',{class:'card'});
if(!d.bans.length)box.appendChild(el('div',{class:'mut',text:'ما فيه محظورين حالياً ✅'}));
d.bans.forEach(function(b){
var k=[el('span',{class:'nm',text:b.display+' (@'+b.name+')'}),el('span',{class:'tag',text:'🆔 '+b.id})];
if(b.trap)k.push(el('span',{class:'tag',text:'🪤 روم الفخ'}));
if(b.reason)k.push(el('span',{class:'mut',text:b.reason.slice(0,60)}));
k.push(el('button',{class:'b2',text:'فك الحظر',on:{click:function(){if(confirm('فك الحظر عن '+b.display+' ؟'))go(api('bans/unban',{id:b.id,confirm:true}),'تم فك الحظر ✅','bans')}}}));
box.appendChild(el('div',{class:'item'},k))});
m.appendChild(box);
m.appendChild(el('div',{class:'mut',text:'ملاحظة: لازم البوت عنده صلاحية "حظر الأعضاء" عشان يقدر يفك الحظر.'}));
return Promise.resolve()})};
pages.log=function(m){return api('log').then(function(d){m.appendChild(el('h1',{text:'السجل'}));var b=el('div',{class:'card'});
if(!d.log.length)b.appendChild(el('div',{class:'mut',text:'ما فيه إجراءات للحين'}));d.log.forEach(function(l){b.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:l.msg}),el('span',{class:'mut',text:l.by+' • '+new Date(l.at).toLocaleString('ar')})]))});m.appendChild(b)})};
// ===== الاقتصاد: الراتب اليومي + متجر الرتب + أرصدة الأعضاء =====
pages.economy=function(m){return api('economy').then(function(d){
var nf=function(n){return Number(n||0).toLocaleString('en-US')};
var coin=d.coin||'🪙';
function ni(v,mn,mx,w){return el('input',{type:'number',value:String(v),min:String(mn),max:String(mx),style:'width:'+(w||115)+'px'})}
m.appendChild(el('h1',{text:'الاقتصاد والمتجر'}));
m.appendChild(el('div',{class:'mut',text:'عملة السيرفر '+coin+' — من هنا تعدّل الراتب اليومي ومتجر الرتب وأرصدة الأعضاء. أوامر /يومي و/المتجر و/شراء تاخذ من هذي الإعدادات فوراً بدون إعادة تشغيل.'}));
var mn=ni(d.daily.min,1,1000000),mx=ni(d.daily.max,1,1000000),cd=ni(d.daily.cdHours,1,168);
var c1=el('div',{class:'card'});
c1.appendChild(el('div',{class:'cat',text:'💰 الراتب اليومي (أمر /يومي)'}));
c1.appendChild(el('div',{class:'row'},[el('span',{class:'mut',text:'أقل راتب'}),mn,el('span',{class:'mut',text:'أكثر راتب'}),mx,el('span',{class:'mut',text:'ينتظر كم ساعة'}),cd]));
c1.appendChild(el('div',{class:'row',style:'margin-top:12px'},[el('button',{class:'btn',text:'💾 حفظ الراتب',on:{click:function(){go(api('economy/daily',{min:mn.value,max:mx.value,cdHours:cd.value}),'انحفظ ✅',null)}}})]));
c1.appendChild(el('div',{class:'mut',style:'margin-top:8px',text:'البوت يعطي رقم عشوائي بين الأقل والأكثر، والعضو ياخذ مرة وحدة كل المدة المحددة (الافتراضي ٢٠ ساعة عشان ما يتراكم).'}));
m.appendChild(c1);
var c2=el('div',{class:'card'});
c2.appendChild(el('div',{class:'cat',text:'🛒 متجر الرتب ('+d.shop.length+' عنصر)'}));
if(!d.shop.length)c2.appendChild(el('div',{class:'mut',text:'المتجر فاضي — ضف رتبة من تحت.'}));
d.shop.forEach(function(it,i){
var p=ni(it.price,1,100000000);
c2.appendChild(el('div',{class:'item'},[
  el('span',{class:'rank',text:String(i+1)}),
  el('span',{class:'nm',text:it.exists?it.name:'⚠️ رتبة محذوفة ('+it.roleId+')'}),
  el('span',{class:'mut',text:coin}),
  p,
  el('button',{class:'b2',text:'💾',title:'حفظ السعر',on:{click:function(){go(api('economy/shop',{action:'price',index:i,price:p.value}),'انحفظ ✅','economy')}}}),
  el('button',{class:'b2',text:'▲',title:'طلّعه فوق',on:{click:function(){go(api('economy/shop',{action:'move',index:i,dir:-1}),'تم ✅','economy')}}}),
  el('button',{class:'b2',text:'▼',title:'نزّله تحت',on:{click:function(){go(api('economy/shop',{action:'move',index:i,dir:1}),'تم ✅','economy')}}}),
  el('button',{class:'dn',text:'🗑',title:'حذف من المتجر',on:{click:function(){if(confirm('أشيل '+(it.name||'العنصر')+' من المتجر؟ (الرتبة نفسها ما تنحذف)'))go(api('economy/shop',{action:'remove',index:i}),'انشال ✅','economy')}}})
]));
});
var rs=el('select',{},[opt('','اختر رتبة تضيفها للمتجر')].concat(d.roles.map(function(r){return opt(r.id,r.name)})));
var np=ni(500,1,100000000);
c2.appendChild(el('div',{class:'row',style:'margin-top:14px'},[rs,np,el('button',{class:'btn',text:'➕ إضافة للمتجر',on:{click:function(){if(!rs.value)return toast('اختر رتبة أول',1);go(api('economy/shop',{action:'add',roleId:rs.value,price:np.value}),'انضاف ✅','economy')}}})]));
c2.appendChild(el('div',{class:'mut',style:'margin-top:8px',text:'الأعضاء يشترون بالأمر /شراء + رقم العنصر — رتّب العناصر بأسهم ▲▼.'}));
m.appendChild(c2);
var c3=el('div',{class:'card'});
c3.appendChild(el('div',{class:'hd'},[el('div',{class:'si gold',text:'🏆'}),el('div',{},[el('div',{class:'ti',text:'عملة السيرفر'}),el('div',{class:'ts',text:'أغنى الأعضاء والمجموع الكلي'})])]));
c3.appendChild(el('div',{class:'kv',style:'margin-bottom:6px'},[
  el('span',{class:'tag on',text:'المجموع '+nf(d.sum)+' '+coin}),
  el('span',{class:'tag',text:'عدد الحسابات '+nf(d.total)})
]));
if(!d.top.length)c3.appendChild(el('div',{class:'mut',text:'ما فيه أحد عنده عملة بعد — أول ما يستخدمون /يومي بيظهرون هنا.'}));
var tmx=Math.max(1,Number(d.top.length?d.top[0].balance:0)||1);
d.top.forEach(function(u,i){
c3.appendChild(el('div',{class:'lrow'},[
  el('div',{class:'rank r'+(i+1),text:i===0?'👑':String(i+1)}),
  el('div',{style:'flex:1;min-width:0'},[el('div',{class:'lnm',text:u.name||('آيدي '+u.id)}),el('div',{class:'bar',style:'height:8px;margin-top:6px'},[el('i',{style:'width:'+Math.max(4,Math.round(u.balance/tmx*100))+'%'})])]),
  el('div',{class:'lpt',text:nf(u.balance)+' '+coin})
]));});
m.appendChild(c3);
var c4=el('div',{class:'card'});
c4.appendChild(el('div',{class:'cat',text:'🔍 رصيد عضو'}));
var q=el('input',{placeholder:'آي دي العضو أو اسمه',style:'flex:1;min-width:200px'}),out=el('div',{});
function find(v){out.innerHTML='';out.appendChild(el('div',{class:'mut',text:'جاري البحث...'}));
api('economy/member?q='+encodeURIComponent(v)).then(function(r){out.innerHTML='';
  if(!r.members.length){out.appendChild(el('div',{class:'mut',text:'ما فيه نتائج'}));return}
  r.members.forEach(function(u){
    var amt=ni(100,1,1000000000,120);
    out.appendChild(el('div',{class:'card'},[
      el('div',{class:'row'},[
        el('img',{src:u.avatar,width:'44',height:'44',style:'border-radius:50%'}),
        el('div',{style:'flex:1;min-width:140px'},[el('div',{text:u.name}),el('div',{class:'mut',text:u.user+' • '+u.id})]),
        el('span',{class:'tag on',text:'الرصيد '+nf(u.balance)+' '+coin})
      ]),
      el('div',{class:'row',style:'margin-top:10px'},[amt,
        el('button',{class:'b2',text:'➕ إضافة',on:{click:function(){bal(u.id,Math.abs(Number(amt.value)))}}}),
        el('button',{class:'b2',text:'➖ خصم',on:{click:function(){bal(u.id,-Math.abs(Number(amt.value)))}}}),
        el('button',{class:'b2',text:'💾 تعيين الرصيد لهذا الرقم',on:{click:function(){if(confirm('أخلي رصيد '+u.name+' بالضبط '+amt.value+' ؟'))bal(u.id,Number(amt.value),true)}}})
      ])
    ]));
  });
}).catch(function(e){out.innerHTML='';out.appendChild(el('div',{class:'mut',text:e.message}))})}
function bal(id,amount,set){api('economy/balance',{id:id,amount:amount,set:!!set}).then(function(r){toast('تم ✅ الرصيد الآن '+nf(r.balance)+' '+coin);find(id)}).catch(function(e){toast(e.message,1)})}
c4.appendChild(row([q,el('button',{class:'btn',text:'بحث',on:{click:function(){if(q.value.trim())find(q.value.trim())}}})]));
c4.appendChild(el('div',{class:'mut',style:'margin:2px 0 10px',text:'الآي دي يشتغل دايماً. البحث بالاسم يحتاج تفعيل MEMBERS_INTENT.'}));
c4.appendChild(out);
m.appendChild(c4);
return Promise.resolve()})};
// ===== القرعات: بدء/إنهاء/إلغاء/إعادة سحب من اللوحة =====
pages.giveaway=function(m){return api('giveaway').then(function(d){
function leftTxt(ms){var s=Math.max(0,Math.floor(ms/1000));if(s<=0)return '⏰ وقته خلص';
  if(s>=3600)return '⏳ '+Math.floor(s/3600)+' ساعة '+Math.floor(s%3600/60)+' دقيقة';
  if(s>=60)return '⏳ '+Math.floor(s/60)+' دقيقة '+String(s%60)+' ث';return '⏳ '+s+' ثانية'}
m.appendChild(el('h1',{text:'القرعات'}));
m.appendChild(el('div',{class:'mut',text:'ابدأ قرعة بضغطة بدون أوامر — الزر اللي ينرسل بالروم هو نفسه زر /قرعة_بدء، والإنهاء واختيار الفائزين يصير تلقائياً عند انتهاء الوقت.'}));
var c1=el('div',{class:'card'});
c1.appendChild(el('div',{class:'cat',text:'🎉 قرعة جديدة'}));
var ch=el('select',{},[opt('','اختر الروم')].concat(d.channels.map(function(c){return opt(c.id,'# '+c.name)})));
var pz=el('input',{placeholder:'الجائزة — مثال: رتبة مميزة أو ٥٠٠ نقطة',style:'flex:1;min-width:200px'});
var mn=el('input',{type:'number',value:'10',min:'1',max:'10080',style:'width:115px'});
var wn=el('input',{type:'number',value:'1',min:'1',max:'10',style:'width:100px'});
c1.appendChild(el('div',{class:'row'},[ch,pz]));
c1.appendChild(el('div',{class:'row',style:'margin-top:12px'},[el('span',{class:'mut',text:'المدة بالدقائق'}),mn,el('span',{class:'mut',text:'عدد الفائزين'}),wn,
el('button',{class:'btn',text:'🚀 ابدأ القرعة',on:{click:function(){
  if(!ch.value)return toast('اختر الروم أول',1);
  if(!pz.value.trim())return toast('اكتب الجائزة',1);
  go(api('giveaway/start',{channelId:ch.value,prize:pz.value,minutes:mn.value,winners:wn.value}),'انطلقت القرعة 🎉','giveaway')}}})]));
m.appendChild(c1);
var c2=el('div',{class:'card'});
c2.appendChild(el('div',{class:'cat',text:'⏳ قرعات شغالة ('+d.active.length+')'}));
if(!d.active.length)c2.appendChild(el('div',{class:'mut',text:'ما فيه قرعة شغالة حالياً.'}));
d.active.forEach(function(w){
var it=el('div',{class:'item'},[
  el('span',{class:'nm',text:w.prize}),
  el('span',{class:'tag',text:'# '+w.channel}),
  el('span',{class:'tag on',text:'👤 '+w.entrants+' متسابق'}),
  el('span',{class:'tag',id:'gwt'+w.id,text:leftTxt(w.endsAt-Date.now())}),
  el('button',{class:'b2',text:'🏁 إنهاء الآن',on:{click:function(){if(confirm('أنهي قرعة «'+w.prize+'» الحين وأختار الفائزين؟'))go(api('giveaway/end',{id:w.id,confirm:true}),'انتهت 🎉','giveaway')}}}),
  el('button',{class:'dn',text:'🗑 إلغاء',on:{click:function(){if(confirm('ألغي قرعة «'+w.prize+'» وأحذف رسالتها؟'))go(api('giveaway/cancel',{id:w.id,confirm:true}),'انلغت ✅','giveaway')}}})
]);
if(w.sample&&w.sample.length)it.appendChild(el('div',{class:'mut',style:'flex-basis:100%',text:'داخلين: '+w.sample.join(' ، ')+(w.entrants>w.sample.length?' وآخرين…':'')}));
c2.appendChild(it)});
m.appendChild(c2);
if(d.ended.length){
var c3=el('div',{class:'card'});
c3.appendChild(el('div',{class:'cat',text:'🏆 قرعات منتهية'}));
d.ended.forEach(function(w){
c3.appendChild(el('div',{class:'item'},[
  el('span',{class:'nm',text:w.prize}),
  el('span',{class:'tag',text:'# '+w.channel}),
  el('span',{class:'tag',text:'👤 '+w.entrants}),
  el('span',{class:'mut',text:w.wonNames.length?'فاز: '+w.wonNames.join(' ، '):'ما فاز أحد'}),
  el('button',{class:'b2',text:'🔄 إعادة سحب',on:{click:function(){if(confirm('أعيد السحب على نفس المتسابقين؟'))go(api('giveaway/reroll',{id:w.id}),'تمت إعادة السحب 🔄','giveaway')}}}),
  el('button',{class:'dn',text:'🗑 حذف',on:{click:function(){if(confirm('أحذف قرعة «'+w.prize+'» من القائمة ورسالتها؟'))go(api('giveaway/cancel',{id:w.id,confirm:true}),'انحذفت ✅','giveaway')}}})
]))});
m.appendChild(c3)}
PAGE_T=setInterval(function(){d.active.forEach(function(w){var n=$('gwt'+w.id);if(n)n.textContent=leftTxt(w.endsAt-Date.now())})},1000);
return Promise.resolve()})};
pages.members=function(m){m.appendChild(el('h1',{text:'الأعضاء'}));
var q=el('input',{placeholder:'آي دي العضو أو اسمه',style:'flex:1;min-width:200px'}),out=el('div',{});
function find(v){out.innerHTML='';Promise.all([api('members/search?q='+encodeURIComponent(v)),api('roles')]).then(function(r){
if(!r[0].members.length){out.appendChild(card('',el('div',{class:'mut',text:'ما فيه نتائج'})));return}
r[0].members.forEach(function(x){out.appendChild(mcard(x,r[1].roles.filter(function(y){return y.editable})))})}).catch(function(e){toast(e.message,1)})}
function mcard(x,roles){var c=el('div',{class:'card'});
c.appendChild(el('div',{class:'row'},[el('img',{src:x.avatar,width:'44',height:'44',style:'border-radius:50%'}),el('div',{},[el('div',{text:x.name+(x.bot?' (بوت)':'')}),el('div',{class:'mut',text:x.user+' • '+x.id})])]));
var rl=el('div',{class:'row',style:'margin:10px 0'});x.roles.forEach(function(r){rl.appendChild(el('span',{class:'tag',text:r.name}))});if(x.timedOut)rl.appendChild(el('span',{class:'tag',text:'مكتوم'}));c.appendChild(rl);
function act(a,ex,msg,gone){api('members/action',Object.assign({id:x.id,action:a},ex||{})).then(function(){toast(msg||'تم ✅');if(gone)out.innerHTML='';else find(x.id)}).catch(function(e){toast(e.message,1)})}
var pamt=el('input',{type:'number',value:'50',style:'width:100px'});
c.appendChild(row([pamt,el('button',{class:'b2',text:'نقاط لعبة +/-',on:{click:function(){api('members/points',{id:x.id,amount:Number(pamt.value)}).then(function(r){toast('تم ✅ المجموع الآن '+r.points)}).catch(function(e){toast(e.message,1)})}}})]));
if(x.owner){c.appendChild(el('div',{class:'mut',text:'محمي 👑 (ما عدا نقاط اللعبة فوق)'}));return c}
var mins=el('input',{type:'number',value:'10',min:'1',style:'width:90px'}),nick=el('input',{placeholder:'اللقب الجديد'}),rs=el('select',{},roles.map(function(r){return opt(r.id,r.name)}));
c.appendChild(row([mins,el('button',{class:'b2',text:'كتم بالدقائق',on:{click:function(){act('timeout',{minutes:Number(mins.value)},'تم الكتم ✅')}}}),el('button',{class:'b2',text:'فك الكتم',on:{click:function(){act('untimeout',{},'تم فك الكتم ✅')}}})]));
c.appendChild(el('p'));c.appendChild(row([nick,el('button',{class:'b2',text:'تغيير اللقب',on:{click:function(){act('nick',{nick:nick.value})}}})]));
c.appendChild(el('p'));c.appendChild(row([rs,el('button',{class:'b2',text:'إضافة رتبة',on:{click:function(){act('addrole',{roleId:rs.value})}}}),el('button',{class:'b2',text:'سحب رتبة',on:{click:function(){act('removerole',{roleId:rs.value})}}})]));
c.appendChild(el('p'));c.appendChild(row([el('button',{class:'dn',text:'طرد',on:{click:function(){if(confirm('تأكيد طرد '+x.name+' ؟'))act('kick',{confirm:true},'تم الطرد',true)}}}),el('button',{class:'dn',text:'حظر',on:{click:function(){if(confirm('تأكيد حظر '+x.name+' ؟'))act('ban',{confirm:true},'تم الحظر',true)}}})]));return c}
m.appendChild(card('بحث',row([q,el('button',{class:'btn',text:'بحث',on:{click:function(){if(q.value.trim())find(q.value.trim())}}})])));
m.appendChild(el('div',{class:'mut',text:'الآي دي يشتغل دايماً. البحث بالاسم يحتاج تفعيل MEMBERS_INTENT.',style:'margin-bottom:12px'}));m.appendChild(out);return Promise.resolve()};
pages.levels=function(m){return api('levels').then(function(d){var c=d.config;
m.appendChild(el('h1',{text:'المستويات والرتب'}));
m.appendChild(el('div',{class:'mut',text:'تحكم بمعدلات كسب الخبرة (XP). المجموع = كتابي + صوتي + مكافآت الألعاب، وبطاقة /رتبة تنعرض كصورة مع الصورة الشخصية وشريط التقدم وترتيبك بالسيرفر.'+(d.dbReady?'':' ⚠️ قاعدة البيانات غير متصلة حالياً.')}));
var lab=function(t){return el('div',{class:'mut',text:t})};
function num(v,step){return el('input',{type:'number',value:String(v),step:step||'1',style:'width:110px'})}
var tE=sw(c.textEnabled,function(){ }),tMin=num(c.textMin),tMax=num(c.textMax),tCd=num(c.textCd);
var vE=sw(c.voiceEnabled,function(){ }),vMin=num(c.voiceMin),vMax=num(c.voiceMax),vTick=num(c.voiceTick),vMm=num(c.voiceMinMembers);
var an=sw(c.announce,function(){ });
function getBool(node){return node.querySelector('input').checked}
function body(){return{textEnabled:getBool(tE),textMin:tMin.value,textMax:tMax.value,textCd:tCd.value,voiceEnabled:getBool(vE),voiceMin:vMin.value,voiceMax:vMax.value,voiceTick:vTick.value,voiceMinMembers:vMm.value,announce:getBool(an)}}
var c1=el('div',{class:'card'});
c1.appendChild(el('div',{class:'cat',text:'معدلات الخبرة'}));
c1.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:'الخبرة الكتابية (الرسائل)'}),tE]));
c1.appendChild(el('div',{class:'row',style:'margin:4px 0 12px'},[lab('أقل خبرة'),tMin,lab('أكثر خبرة'),tMax,lab('كل كم ثانية'),tCd]));
c1.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:'الخبرة الصوتية (وقت الفويس)'}),vE]));
c1.appendChild(el('div',{class:'row',style:'margin:4px 0 12px'},[lab('أقل خبرة/دورة'),vMin,lab('أكثر خبرة'),vMax,lab('كل كم ثانية'),vTick,lab('أقل عدد أعضاء بالروم'),vMm]));
c1.appendChild(el('div',{class:'item'},[el('span',{class:'nm',text:'إعلان الترقية بالشات'}),an]));
c1.appendChild(el('div',{class:'row',style:'margin-top:10px'},[el('button',{class:'btn',text:'حفظ المعدلات',on:{click:function(){go(api('levels/save',body()),'انحفظ ✅',null)}}})]));
m.appendChild(c1);
var lb=el('div',{class:'card'});
lb.appendChild(el('div',{class:'cat',text:'المتصدرين (أعلى 25)'}));
if(!d.leaderboard.length)lb.appendChild(el('div',{class:'mut',text:'ما فيه أحد عنده XP للحين.'}));
d.leaderboard.forEach(function(x,i){
  lb.appendChild(el('div',{class:'item'},[
    el('span',{class:'tag',text:'#'+(i+1)}),
    x.avatar?el('img',{src:x.avatar,width:'30',height:'30',style:'border-radius:50%'}):null,
    el('span',{class:'nm',text:x.name}),
    el('span',{class:'tag',text:'كتابي '+fmt(x.textXp)}),
    el('span',{class:'tag',text:'صوتي '+fmt(x.voiceXp)}),
    el('span',{class:'tag on',text:'م'+x.totalLevel+' • إجمالي '+fmt(x.points)}),
    el('button',{class:'btn',text:'✏️ تعديل',on:{click:function(){load(x.id)}}})
  ]));
});
m.appendChild(lb);
var my=el('div',{class:'card'});
my.appendChild(el('div',{class:'cat',text:'حسابي 👤 — مستواي وترتيبي'}));
my.appendChild(el('div',{class:'mut',text:'جاري تحميل مستواك...'}));
m.appendChild(my);

var ed=el('div',{class:'card'});
ed.appendChild(el('div',{class:'cat',text:'فتح ملف أي عضو'}));
var q=el('input',{placeholder:'آي دي العضو أو اسمه',style:'flex:1;min-width:200px'});
var out=el('div',{class:'mut',text:'ما فيه ملف مفتوح حالياً — اختر عضو من المتصدرين، أو اضغط «تعديل ملفي»، أو اكتب الآي دي هنا.',style:'margin-top:10px'});
ed.appendChild(row([q,el('button',{class:'btn',text:'🔍 فتح الملف',on:{click:function(){load(q.value)}}})]));
ed.appendChild(el('div',{class:'mut',text:'البحث بالاسم يحتاج تفعيل MEMBERS_INTENT، والآي دي يشتغل دايماً.',style:'margin:8px 0'}));
ed.appendChild(out);
m.appendChild(ed);

function fmt(n){n=Number(n||0);return n.toLocaleString('en-US')}
function xpBar(cur,lo,hi){var pc=hi>lo?Math.round(((cur-lo)/(hi-lo))*100):100;pc=Math.max(0,Math.min(100,pc));return el('div',{class:'bar'},[el('i',{style:'width:'+pc+'%'})])}
function head(r,p){return el('div',{class:'row'},[
  el('img',{class:'av',src:r.member.avatar}),
  el('div',{style:'flex:1;min-width:150px'},[el('div',{style:'font-weight:700;font-size:17px',text:r.member.name}),el('div',{class:'mut',text:r.member.id+' • الترتيب #'+(p.rank||1)})]),
  el('span',{class:'tag on',text:'المستوى '+(p.totalLevel||0)}),
  el('span',{class:'tag',text:'كتابي م'+(p.textLevel||0)}),
  el('span',{class:'tag',text:'صوتي م'+(p.voiceLevel||0)})
])}
function bars(p){var w=el('div',{});var cur=Number(p.points||0),lo=Number(p.lo||0),hi=Number(p.hi||0);
  w.appendChild(el('div',{class:'mut',style:'margin:12px 0 5px',text:'الإجمالي '+fmt(cur)+' XP • التقدم للمستوى '+((p.totalLevel||0)+1)+': '+fmt(cur)+' / '+fmt(hi)+' XP — باقي '+fmt(Math.max(0,hi-cur))}));
  w.appendChild(xpBar(cur,lo,hi));
  w.appendChild(el('div',{class:'mut',style:'margin:12px 0 5px',text:'الخبرة الكتابية '+fmt(p.textXp)+' XP (مستوى '+(p.textLevel||0)+')'}));
  w.appendChild(xpBar(Number(p.textXp||0),Number(p.textLo||0),Number(p.textHi||0)));
  w.appendChild(el('div',{class:'mut',style:'margin:12px 0 5px',text:'الخبرة الصوتية '+fmt(p.voiceXp)+' XP (مستوى '+(p.voiceLevel||0)+')'}));
  w.appendChild(xpBar(Number(p.voiceXp||0),Number(p.voiceLo||0),Number(p.voiceHi||0)));
  return w}
function editor(r){var p=r.profile||{};var box=el('div',{});
  box.appendChild(el('div',{class:'cat',text:'ملف العضو'}));
  box.appendChild(head(r,p));box.appendChild(bars(p));
  var pi=num(p.points||0),ti=num(p.textXp||0),vi=num(p.voiceXp||0),amt=num(100);
  box.appendChild(el('div',{class:'row',style:'margin-top:14px'},[lab('الإجمالي XP'),pi,lab('كتابي XP'),ti,lab('صوتي XP'),vi]));
  box.appendChild(el('div',{class:'row',style:'margin-top:10px'},[
    el('button',{class:'btn',text:'💾 حفظ القيم',on:{click:function(){run(api('levels/edit',{id:r.member.id,points:Number(pi.value),textXp:Number(ti.value),voiceXp:Number(vi.value)}),'انحفظ ✅')}}}),
    el('button',{class:'b2',text:'↻ تحديث البيانات',on:{click:function(){load(r.member.id)}}})
  ]));
  box.appendChild(el('div',{class:'row',style:'margin-top:10px'},[amt,
    el('button',{class:'b2',text:'➕ إضافة XP',on:{click:function(){run(api('levels/edit',{id:r.member.id,add:Math.abs(Number(amt.value))}),'تم ✅')}}}),
    el('button',{class:'b2',text:'➖ خصم XP',on:{click:function(){run(api('levels/edit',{id:r.member.id,add:-Math.abs(Number(amt.value))}),'تم ✅')}}})
  ]));
  box.appendChild(el('div',{class:'mut',style:'margin-top:12px',text:'الإجمالي = كتابي + صوتي + مكافآت الألعاب. الحفظ ينفذ مباشرة في قاعدة البيانات.'}));
  return box}
var modal=null;
function closeModal(){if(modal){modal.remove();modal=null}}
function openModal(r){closeModal();
  var box=el('div',{class:'ovc'},[
    el('div',{class:'row'},[el('div',{class:'cat',style:'flex:1;margin:0',text:'تعديل XP وملف العضو'}),el('button',{class:'b2',text:'✕ إغلاق',on:{click:function(){closeModal()}}})]),
    editor(r)
  ]);
  modal=el('div',{class:'ov'},[box]);
  modal.addEventListener('click',function(e){if(e.target===modal)closeModal()});
  document.body.appendChild(modal);
  out.textContent='آخر ملف مفتوح: '+r.member.name+' — لو ما ظهرت النافذة، اضغط «فتح الملف» مرة ثانية.';
}
function run(fn,msg){fn.then(function(){toast(msg||'تم ✅');closeModal();show('levels')}).catch(function(e){toast(e.message,1)})}
function load(v){v=String(v||'').trim();toast('جاري فتح الملف...');
  api(v?'levels/member?id='+encodeURIComponent(v):'levels/me').then(function(r){openModal(r)}).catch(function(e){toast(e.message,1)})}

api('levels/me').then(function(r){var p=r.profile||{};my.innerHTML='';
  my.appendChild(el('div',{class:'cat',text:'حسابي 👤 — مستواي وترتيبي'}));
  my.appendChild(el('div',{class:'row'},[
    el('img',{class:'av',src:r.member.avatar}),
    el('div',{style:'flex:1;min-width:150px'},[el('div',{style:'font-weight:700;font-size:17px',text:r.member.name}),el('div',{class:'mut',text:'ترتيبك #'+(p.rank||1)+' • إجمالي '+fmt(p.points)+' XP'})]),
    el('span',{class:'tag on',text:'مستواك '+(p.totalLevel||0)}),
    el('span',{class:'tag',text:'كتابي م'+(p.textLevel||0)}),
    el('span',{class:'tag',text:'صوتي م'+(p.voiceLevel||0)}),
    el('button',{class:'btn',text:'✏️ تعديل ملفي',on:{click:function(){openModal(r)}}})
  ]));
  my.appendChild(bars(p));
}).catch(function(e){my.innerHTML='';my.appendChild(el('div',{class:'cat',text:'حسابي 👤'}));my.appendChild(el('div',{class:'mut',text:'تعذر تحميل مستواك: '+e.message}))});
return Promise.resolve()})};
function boot(){api('me').then(function(d){var r=$('root');
if(!d.enabled){r.appendChild(el('div',{class:'main'},[card('',el('div',{text:'اللوحة غير مفعلة: ناقص DISCORD_CLIENT_ID أو DISCORD_CLIENT_SECRET أو SESSION_SECRET في الاستضافة'}))]));return}
if(!d.user){r.appendChild(el('div',{class:'main'},[el('div',{class:'hero'},[el('div',{class:'hlogo',text:'👑'}),el('div',{style:'flex:1'},[el('h1',{text:'لوحة نوفا'}),el('div',{class:'sub',text:'سجّل دخولك بحساب ديسكورد — الدخول للأعضاء المصرّح لهم فقط'})])]),el('a',{class:'btn',href:'/auth/login',text:'تسجيل الدخول بديسكورد'})]));return}
if(!d.guild||!(d.guilds||[]).length){r.appendChild(guildPicker(d));return}
var logo=el('div',{class:'logo'});logo.innerHTML=NOVA_MARK_SVG+'<span>'+d.guild.name.slice(0,22)+'</span>';
var sb=el('div',{class:'sb'},[logo].concat(NAV.filter(function(n){return navOk(n,d)}).map(function(n){
  if(n.length===1)return el('div',{class:'navlab',text:n[0].slice(1)});
  var b=el('button',{class:'nav','data-p':n[0]},[el('span',{class:'ic',text:n[1]}),el('span',{text:n[2]})].concat(n[3]==='super'||n[3]==='root'?[el('span',{style:'margin-inline-start:auto;font-size:11px;opacity:.85',text:'👑'})]:[]));
  b.addEventListener('click',function(){show(n[0])});return b})).concat([
  el('a',{class:'nav',href:'/auth/logout'},[el('span',{class:'ic',text:'🚪'}),el('span',{text:'خروج ('+d.user.name+')'})])
]));
var pill=el('div',{class:'pill'},[el('span',{class:'pdot'}),el('span',{text:'جاري الفحص…'})]);
var chip=el('div',{class:'uchip'},[el('span',{class:'uav',text:String(d.user.name||'؟').slice(0,1).toUpperCase()}),el('span',{class:'unm',text:d.user.name})]);
// 🔁 مبدّل السيرفر (يطلع فقط لو عندك صلاحية أكثر من سيرفر)
var gsel=el('select',{class:'gsel',title:'تبديل السيرفر'});
(d.guilds||[]).forEach(function(g){gsel.appendChild(el('option',{value:g.id,text:g.name}))});
gsel.value=d.guild.id;
if((d.guilds||[]).length>1){gsel.addEventListener('change',function(){api('guild',{id:gsel.value}).then(function(){location.reload()}).catch(function(e){toast(e.message,1);gsel.value=d.guild.id})})}
else{gsel.style.display='none'}
var bgbtn=el('button',{class:'iconbtn',title:'حركة الخلفية (تشغيل/إيقاف)',text:'🎞️'});
bgbtn.style.opacity=(BG&&BG.want)?'1':'.45';
bgbtn.addEventListener('click',function(){if(!BG)return;var on=BG.toggle();bgbtn.style.opacity=on?'1':'.45';toast(on?'شغّلت حركة الخلفية ✨':'وقّفت حركة الخلفية ⏸️')});
var tb=el('div',{class:'topbar'},[pill,el('div',{style:'flex:1'}),gsel,bgbtn,chip]);
r.appendChild(el('div',{class:'app'},[sb,el('div',{class:'wrap'},[tb,el('div',{class:'page',id:'main'})])]));
show('overview');
api('ping').then(function(p){pill.className='pill '+(p.bot?'on':'off');pill.innerHTML='';pill.appendChild(el('span',{class:'pdot'}));pill.appendChild(el('span',{text:(p.bot?'البوت متصل ٢٤/٧':'البوت غير جاهز')+' • مدة التشغيل '+p.mins+' دقيقة'}))}).catch(function(){pill.className='pill off';pill.innerHTML='';pill.appendChild(el('span',{class:'pdot'}));pill.appendChild(el('span',{text:'تعذّر فحص الاتصال'}))});
}).catch(function(e){document.body.textContent=e.message})}
// ===== 🌐 السيرفرات: البوت مقفول افتراضياً — مين يشتغل ومين لا (فوق الكل فقط) =====
pages.guilds=function(m){return api('guilds').then(function(d){
 m.appendChild(el('h1',{text:'السيرفرات 🌐'}));
 m.appendChild(el('div',{class:'mut',text:'🔒 البوت مقفول افتراضياً: أي سيرفر جديد يضيف البوت يظل مقفول — ما يرد، ولا تنزل أوامره، ولا تنفتح لوحته — إلا لما تفعّله من هنا. (سيرفرنا مفعّل دايماً.)'}));
 var box=el('div',{});
 (d.guilds||[]).forEach(function(g){
  var on=!!g.approved;
  var btn=el('button',{class:'btn '+(on?'dn':''),text:on?'🔒 اقفل':'🔓 فعّل'});
  btn.addEventListener('click',function(){
   btn.disabled=true;
   api('guilds/approve',{id:g.id,on:!on}).then(function(){
    toast(on?'🔒 انقفل السيرفر':'🔓 انفعّل السيرفر ('+(g.name||'')+')');
    show('guilds');
   }).catch(function(e){btn.disabled=false;toast(e.message,1)});
  });
  var open=el('button',{class:'b2',text:'فتح لوحته'});
  open.addEventListener('click',function(){
   api('guild',{id:g.id}).then(function(){location.reload()}).catch(function(e){toast(e.message,1)});
  });
  box.appendChild(el('div',{class:'item'},[
   el('span',{class:'ic',text:g.nova?'👑':'🏠'}),
   el('div',{style:'flex:1;min-width:0;text-align:right'},[
    el('div',{class:'nm',text:g.name}),
    el('div',{class:'mut',style:'font-size:12px',text:'👥 '+(g.members||0)+' عضو · 🔑 '+(g.allowed||0)+' مسموح'+(g.nova?' · سيرفرنا':'')})
   ]),
   el('span',{class:'tag '+(on?'on':'off'),text:on?'✅ مفعّل':'🔒 مقفول'}),
   btn, open
  ]));
 });
 m.appendChild(card('كل السيرفرات ('+(d.total||0)+') · المفعّلة: '+(d.active||0),box));
 m.appendChild(el('div',{class:'mut',style:'margin:10px 4px;font-size:12px;line-height:1.9',text:'فعّل السيرفر → تنزل أوامره فوراً ويصير شغال. اقفله → تنمسح أوامره ويتوقف عن الرد (وبعدها يقدر صاحبه يدخل لوحته ويضيف مسؤولينه من «صلاحية الدخول 🔑»).'}));
 return;
})}
// ===== 🔑 صلاحية الدخول للوحة (لكل سيرفر لحاله) =====
pages.access=function(m){return api('access').then(function(d){
 m.appendChild(el('h1',{text:'صلاحية الدخول للوحة'}));
 m.appendChild(el('div',{class:'mut',text:'اللوحة ما تنفتح بالرابط — اللي تضيفه هنا بس هو اللي يقدر يدخل لوحة هذا السيرفر ويدير أنظمته. وإدارة نوفا (ارثر/إيدا) تدخل كل السيرفرات دايماً.'}));
 if(d.approved===false){m.appendChild(card('🔒 السيرفر مقفول',el('div',{class:'mut',style:'line-height:1.9',text:'هذا السيرفر ما فعّلناه بعد — البوت فيه ما يرد ولا تنزل أوامره. فعّله من صفحة «السيرفرات 🌐» (لإدارة نوفا) وبعدها يصير كل شي شغال.'})));}
 if(!(d.canManage||d.isSuper)){m.appendChild(card('ما عندك صلاحية',el('div',{class:'mut',text:'تعديل قائمة الدخول يسويه صاحب السيرفر أو إدارة نوفا فقط.'})));return}
 var byId=el('input',{placeholder:'آيدي الحساب (أرقام فقط)',style:'flex:1;min-width:180px'});
 var addId=el('button',{class:'btn',text:'➕ إضافة بالآيدي'});
 addId.addEventListener('click',function(){
   var id=String(byId.value||'').replace(/[^0-9]/g,'');
   if(!id)return toast('اكتب آيدي الحساب أول',1);
   go(api('access/add',{id:id}),'تم إعطاء الصلاحية ✅','access');
 });
 var q=el('input',{placeholder:'أو ابحث بالاسم (تكفي أول حرفين)',style:'flex:1;min-width:180px'});
 var found=el('div',{});
 var sbtn=el('button',{class:'b2',text:'🔍 بحث'});
 sbtn.addEventListener('click',function(){
   var v=String(q.value||'').trim();
   if(v.length<2)return toast('اكتب حرفين على الأقل',1);
   found.innerHTML='';
   api('access/find?q='+encodeURIComponent(v)).then(function(r){
     var fs=(r&&r.found)||[];
     if(!fs.length){found.appendChild(el('div',{class:'mut',text:'ما لقيت أحد بهذا الاسم — تقدر تحط آيديه مباشرة فوق.'}));return}
     fs.forEach(function(u){
       var nm=el('div',{class:'nm',text:u.name+(u.bot?' 🤖':'')});
       var add=el('button',{class:'b2',text:'➕ إضافة'});
       add.addEventListener('click',function(){go(api('access/add',{id:u.id}),'تمت الإضافة ✅','access')});
       found.appendChild(el('div',{class:'item'},[el('div',{style:'flex:1;min-width:0'},[nm,el('div',{class:'mut',text:u.id})]),add]));
     });
   }).catch(function(e){toast(e.message,1)});
 });
 m.appendChild(card('إضافة حساب',el('div',{},[
   el('div',{class:'mut',text:'حط آيدي الحساب مباشرة أو ابحث بالاسم ثم اضغط إضافة.'}),
   el('div',{class:'row',style:'margin-top:8px'},[byId,addId]),
   el('div',{class:'row',style:'margin-top:8px'},[q,sbtn]),
   found
 ])));
 var list=(d.list||[]),box=el('div',{});
 if(!list.length)box.appendChild(el('div',{class:'mut',text:'ما فيه أحد مضاف حالياً — يعني ما يقدر يدخل اللوحة غير إدارة نوفا.'}));
 list.forEach(function(e){
   var rm=el('button',{class:'dn',text:'🗑️ سحب'});
   rm.addEventListener('click',function(){if(!confirm('تسحب صلاحية الدخول عن هذا الحساب؟'))return;go(api('access/remove',{id:e.id}),'انشالت الصلاحية','access')});
   box.appendChild(el('div',{class:'item'},[
     el('div',{style:'flex:1;min-width:0'},[el('div',{class:'nm',text:(e.name&&e.name!==e.id)?e.name:e.id}),el('div',{class:'mut',text:e.id})]),
     rm
   ]));
 });
 m.appendChild(card('المسموح لهم ('+list.length+')',box));
 m.appendChild(el('div',{class:'mut',style:'margin-top:8px',text:'صاحب السيرفر يقدر يدخل لوحته دايماً حتى لو ما كان بالقائمة. وهذي القائمة خاصة بهذا السيرفر لحاله.'}));
 if(d.isSuper)m.appendChild(el('div',{class:'mut',style:'margin-top:4px',text:'إدارة نوفا (ارثر/إيدا) داخلين كل السيرفرات تلقائياً.'}));
 m.appendChild(el('div',{class:'row',style:'margin-top:10px'},[el('button',{class:'b2',text:'🔄 تحديث',on:{click:function(){show('access')}}})]));
})}
// شاشة اختيار السيرفر (لمن عنده صلاحية أكثر من سيرفر)
function guildPicker(d){var m=el('div',{class:'main'},[el('div',{class:'hero'},[el('div',{class:'hlogo',text:'🏠'}),el('div',{style:'flex:1'},[el('h1',{text:'اختر السيرفر'}),el('div',{class:'sub',text:'عندك صلاحية دخول لوحة أكثر من سيرفر — اختر اللي تبي تديره'})])])]);
 var box=el('div',{});
 (d.guilds||[]).forEach(function(g){
  var b=el('button',{class:'item gp'},[el('span',{class:'ic',text:'🏠'}),el('div',{style:'flex:1;text-align:right;min-width:0'},[el('div',{class:'nm',text:g.name})]),el('span',{class:'mut',text:'❯'})]);
  b.addEventListener('click',function(){api('guild',{id:g.id}).then(function(){location.reload()}).catch(function(e){toast(e.message,1)})});
  box.appendChild(b);
 });
 m.appendChild(card('سيرفراتك',box));
 if(!(d.guilds||[]).length)m.appendChild(el('div',{class:'mut',style:'margin:10px 4px;line-height:1.9',text:'ما عندك صلاحية دخول لوحة أي سيرفر حالياً. اللوحة ما تنفتح بالرابط — لازم إدارة نوفا تعطيك صلاحية الدخول من صفحة «صلاحية الدخول 🔑». (وإذا سيرفرك جديد: البوت مقفول افتراضياً ولازم إدارة نوفا تفعّله من «السيرفرات 🌐» أول.)'}));
 m.appendChild(el('div',{class:'row',style:'margin-top:10px'},[el('a',{class:'b2',href:'/auth/logout',text:'🚪 خروج ('+d.user.name+')'})]));
 return m}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){});
boot();
</script></body></html>`;

module.exports = function mountDashboard(app, express, client, CONFIG) {
    const enabled = !!(SECRET && CID && CSEC);
    const session = (req) => verify(cookies(req).dash);
    const redirectUri = () => BASE() + '/auth/callback';

    // السيرفرات المسموحة لحساب: فوق الكل = كل السيرفرات · غيره = اللي بقائمة المسموحين (اللي عطيتها بإيدي) أو صاحب السيرفر
    async function guildsFor(u) {
        return access.guildsOf(client, u.id, CONFIG)
            .map(g => ({ id: g.id, name: g.name, icon: g.iconURL({ size: 64 }) || '' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }
    // بيانات السيرفر المختار من الجلسة (مع التحقق إنه ما زال مسموحاً)
    function guildId(req) {
        const s = session(req);
        const gid = s && s.gid;
        if (!gid) return '';
        const g = client.guilds.cache.get(gid);
        if (!g) return '';
        return access.canUse(g, s.id, CONFIG) ? gid : '';
    }

    app.get('/dashboard', (req, res) => res.type('html').set('Cache-Control', 'no-store').send(PAGE));

    // تثبيت اللوحة كتطبيق على الجوال (PWA)
    app.get('/manifest.webmanifest', (req, res) => res.type('application/manifest+json').send(JSON.stringify({
        id: '/dashboard', name: 'لوحة نوفا الملكية', short_name: 'NOVA', lang: 'ar', dir: 'rtl', categories: ['utilities'],
        start_url: '/dashboard', scope: '/', display: 'standalone', orientation: 'portrait',
        background_color: '#0f0e14', theme_color: '#0f0e14',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
    })));
    app.get('/sw.js', (req, res) => res.type('application/javascript').set('Cache-Control', 'no-cache')
        .send("self.addEventListener('install',function(){self.skipWaiting()});self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});self.addEventListener('fetch',function(){});"));
    // ربط ملف APK بالموقع (يشيل شريط المتصفح من التطبيق). تحط ملف assetlinks.json في جذر الريبو
    app.get('/.well-known/assetlinks.json', (req, res) =>
        res.type('application/json').sendFile(path.join(__dirname, 'assetlinks.json'), (err) => { if (err && !res.headersSent) res.status(404).json([]); }));
    for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable.png']) {
        app.get('/' + f, (req, res) => res.sendFile(path.join(__dirname, f), (err) => { if (err) res.status(404).end(); }));
    }

    app.get('/auth/login', (req, res) => {
        if (!enabled) return res.status(503).send('اللوحة غير مفعلة');
        const state = crypto.randomBytes(16).toString('hex');
        setCookie(res, 'oauth_state', state, 600);
        res.redirect('https://discord.com/oauth2/authorize?' + new URLSearchParams({
            client_id: CID, response_type: 'code', scope: 'identify', redirect_uri: redirectUri(), state
        }));
    });

    app.get('/auth/callback', async (req, res) => {
        try {
            if (!enabled) return res.status(503).send('اللوحة غير مفعلة');
            const { code, state } = req.query;
            if (!code || !state || state !== cookies(req).oauth_state) return res.status(400).send('طلب غير صالح، جرب مرة ثانية');
            const tr = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: CID, client_secret: CSEC, grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri() })
            });
            const tok = await tr.json();
            if (!tok.access_token) return res.status(400).send('فشل تسجيل الدخول (تأكد من Redirect URI في موقع المطورين)');
            const u = await (await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + tok.access_token } })).json();
            if (!u.id) return res.status(403).send('⛔ تعذر قراءة حسابك من ديسكورد، جرب مرة ثانية');
            // 🔑 ما يدخل إلا اللي عنده صلاحية: فوق الكل (ارثر/إيدا) أو موجود بقائمة مسموحين سيرفر
            const list = await guildsFor(u);
            if (!list.length) return res.status(403).send(
                '<meta charset="utf-8"><div style="font-family:system-ui;direction:rtl;text-align:center;padding:60px 20px;background:#0f0e14;color:#eee;min-height:100vh">'
                + '<div style="font-size:52px">🔒</div><h2>حسابك مو مسموح له بدخول اللوحة</h2>'
                + '<p style="color:#aaa">اللوحة ما تنفتح بالرابط — لازم إدارة السيرفر تعطيك صلاحية الدخول أول.</p>'
                + '<a href="/dashboard" style="color:#e0b64f">رجوع</a></div>');
            const gid = list.length === 1 ? list[0].id : '';   // سيرفر واحد → يدخل عليه مباشرة
            setCookie(res, 'dash', sign({ id: u.id, name: u.global_name || u.username, gid, exp: Date.now() + WEEK }), WEEK / 1000);
            setCookie(res, 'oauth_state', '', 0);
            res.redirect('/dashboard');
        } catch (e) {
            console.error('❌ OAuth:', e.message);
            res.status(500).send('صار خطأ بتسجيل الدخول');
        }
    });

    app.get('/auth/logout', (req, res) => { setCookie(res, 'dash', '', 0); res.redirect('/dashboard'); });

    const api = express.Router();
    api.use(express.json({ limit: '100kb' }));
    api.get('/me', async (req, res) => {
        const s = session(req);
        if (!s) return res.json({ enabled, user: null });
        const guilds = await guildsFor(s);
        const gid = guildId(req) || (guilds.length === 1 ? guilds[0].id : '');
        const g = gid ? client.guilds.cache.get(gid) : null;
        res.json({
            enabled,
            user: { id: s.id, name: s.name },
            guilds,
            guild: g ? { id: g.id, name: g.name, icon: g.iconURL({ size: 64 }) || '' } : null,
            nova: !!(g && String(g.id) === String(CONFIG.GUILD_ID)),
            canManageAccess: !!(g && access.canManage(g, s.id, CONFIG)),
            isSuper: access.isSuper(s.id, CONFIG)
        });
    });
    // فحص سريع من المتصفح (بدون تسجيل دخول): يثبت أن السيرفر يرجع JSON فعلاً
    api.get('/ping', (req, res) => res.json({ ok: true, build: BUILD, bot: client.isReady(), uptime: Math.round(process.uptime()), mins: Math.round(process.uptime() / 60), publicUrl: BASE() }));
    api.use((req, res, next) => {
        const s = enabled && session(req);
        if (!s) return res.status(401).json({ error: 'سجّل دخولك أول' });
        if (req.method !== 'GET' && req.get('x-dash') !== '1') return res.status(403).json({ error: 'طلب مرفوض' });
        req.user = s;
        next();
    });

    // تبديل السيرفر (من مبدّل السيرفر بالشريط العلوي)
    api.post('/guild', async (req, res) => {
        try {
            const s = session(req);
            const want = String((req.body && req.body.id) || '');
            const list = await guildsFor(s);
            if (!list.some(x => x.id === want)) return res.status(403).json({ error: 'ما عندك صلاحية دخول لوحة هذا السيرفر' });
            setCookie(res, 'dash', sign({ id: s.id, name: s.name, gid: want, exp: Date.now() + WEEK }), WEEK / 1000);
            res.json({ ok: true, guild: list.find(x => x.id === want), guilds: list });
        } catch (e) { res.status(400).json({ error: String(e.message || 'خطأ') }); }
    });

    const note = (req, msg) => {
        const l = store.read('dashlog.json', []);
        l.unshift({ at: Date.now(), by: req.user.name, msg, gid: guildId(req) || '' });
        store.write('dashlog.json', l.slice(0, 300));
    };
    // السيرفر الحالي من الجلسة — كل مسارات الـAPI تتبع السيرفر المختار
    const h = (fn) => async (req, res) => {
        try {
            const gid = guildId(req);
            if (!gid) return res.status(409).json({ error: 'اختر سيرفر أول (ما فيه سيرفر محدد بجلستك)' });
            const g = client.guilds.cache.get(gid);
            if (!g) return res.status(503).json({ error: 'البوت مو متصل بهذا السيرفر' });
            res.json((await fn(g, req.body || {}, req)) || { ok: true });
        } catch (e) {
            const msg = e.code === 50013 ? 'البوت ما عنده صلاحية، ارفع رتبته أو أعطه الصلاحية' : String(e.message || 'خطأ').slice(0, 150);
            res.status(400).json({ error: msg });
        }
    };
    const chan = (g, id) => { const c = g.channels.cache.get(String(id)); if (!c) throw new Error('الروم مو موجود'); return c; };
    // 🔒 صفحات/مسارات خاصة بسيرفرنا فقط (الردود العامة + حالة البوت — لأنها ما تتقسم لكل سيرفر)
    const novaOnly = (req, res) => {
        if (String(guildId(req)) === String(CONFIG.GUILD_ID)) return true;
        res.status(400).json({ error: 'هذي الصفحة خاصة بسيرفر نوفا فقط' });
        return false;
    };
    // 👑 ولازم يكون ارثر أو إيدا نفسه (ما تنفتح لأي أحد بالقائمة — حتى لو كان بسيرفرنا)
    const superOnly = (req, res) => {
        const s = session(req);
        if (s && access.isSuper(s.id, CONFIG)) return true;
        res.status(403).json({ error: 'هذي الصفحة خاصة بصاحب البوت فقط 👑' });
        return false;
    };
    const hn = (fn) => (req, res) => { if (!novaOnly(req, res)) return; if (!superOnly(req, res)) return; return h(fn)(req, res); };
    // 💬 الردود: لكل سيرفر لوحته — لكن **أقسام سيرفر نوفا** تبقى 👑 لارثر/إيدا فقط (خصوصية)
    const repOnly = (req, res) => {
        if (String(guildId(req)) !== String(CONFIG.GUILD_ID)) return true;
        const s = session(req);
        if (s && access.isSuper(s.id, CONFIG)) return true;
        res.status(403).json({ error: 'هذي الصفحة خاصة بصاحب البوت فقط 👑' });
        return false;
    };
    const hr = (fn) => (req, res) => { if (!repOnly(req, res)) return; return h(fn)(req, res); };
    const role = (g, id) => { const r = g.roles.cache.get(String(id)); if (!r || r.id === g.id) throw new Error('الرتبة مو موجودة'); return r; };
    const isCat = (c) => c.type === ChannelType.GuildCategory;

    api.get('/overview', h(async (g) => ({ name: g.name, members: g.memberCount, channels: g.channels.cache.size, roles: g.roles.cache.size, build: BUILD })));
    // السجل: يبيّن عمليات هذا السيرفر فقط (كل سيرفر لحاله)
    api.get('/log', h(async (g) => {
        const novaLegacy = (e) => !e.gid && String(g.id) === String(CONFIG.GUILD_ID);
        const mine = store.read('dashlog.json', []).filter(e => novaLegacy(e) || String(e.gid) === String(g.id));
        const guardLog = store.read('log.json', []).filter(e => novaLegacy(e) || String(e.gid) === String(g.id))
            .map(e => ({ at: e.at, by: e.by || 'درع نوفا', msg: e.msg }));
        return { log: mine.concat(guardLog).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 100) };
    }));

    // ===== الردود: نفس وظيفة لوحة /panel لكن داخل الداشبورد (بدون كلمة مرور) — لسيرفرنا فقط =====
    // ===== 😍 الرياكشن: البوت يحط إيموجي (حتى ٣) على أي صورة تنزل برومات محددة =====
    api.get('/react', h(async (g) => {
        await g.channels.fetch().catch(() => {});
        const me = g.members.me || (typeof g.members.fetchMe === 'function' ? await g.members.fetchMe().catch(() => null) : null);
        const can = (p) => !!(me && me.permissions.has(p));
        const channels = [...g.channels.cache.values()]
            .filter(c => !c.isThread() && c.isTextBased && c.isTextBased())
            .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
            .map(c => ({ id: c.id, name: c.name, parentId: c.parentId || '' }));
        return {
            cfg: reactions.get(g.id),
            channels,
            stat: reactions.stat(g.id),
            maxEmoji: reactions.MAX_EMOJI,
            maxChannels: reactions.MAX_CHANNELS,
            can: {
                view: can(PermissionFlagsBits.ViewChannel),
                react: can(PermissionFlagsBits.AddReactions),
                history: can(PermissionFlagsBits.ReadMessageHistory)
            }
        };
    }));
    api.post('/react/save', h(async (g, b, req) => {
        const cfg = reactions.set(g.id, b);
        note(req, `حفظ إعدادات الرياكشن (${cfg.channels.length} روم · ${cfg.emojis.join(' ')})`);
        return { ok: true, cfg };
    }));
    api.post('/react/reset', h(async (g, b, req) => {
        reactions.reset(g.id);
        note(req, 'رجوع إعدادات الرياكشن للافتراضي');
        return { ok: true, cfg: reactions.get(g.id) };
    }));

    api.get('/replies', hr(async () => ({ all: replies.all(), custom: replies.overrides() })));
    api.post('/replies/save', hr(async (g, b, req) => {
        const key = String((b && b.key) || '').trim();
        if (!key || !Array.isArray(b.lines) || !replies.set(key, b.lines))
            throw new Error('طلب غير صالح — تأكد أن اسم التصنيف بصيغة فئة.اسم');
        note(req, 'تعديل الردود: ' + key);
        return { all: replies.all(), custom: replies.overrides() };
    }));
    api.post('/replies/reset', hr(async (g, b, req) => {
        const key = String((b && b.key) || '').trim();
        if (!key) throw new Error('طلب غير صالح');
        replies.reset(key);
        note(req, 'إرجاع الردود للافتراضي: ' + key);
        return { all: replies.all(), custom: replies.overrides() };
    }));
    api.post('/replies/import', hr(async (g, b, req) => {
        const n = replies.importAll((b && b.map) || {});
        note(req, `استيراد نسخة ردود (${n} تصنيف)`);
        return { imported: n, all: replies.all(), custom: replies.overrides() };
    }));

    // ===== 💬 محرر الردود الجديد (أقسام لكل سيرفر) =====
    api.get('/rep2', hr(async (g) => {
        const isNova = String(g.id) === String(CONFIG.GUILD_ID);
        const roles = [...g.roles.cache.values()]
            .filter(r => r && r.id !== g.id && !r.managed)
            .sort((a, b) => (b.position || 0) - (a.position || 0))
            .slice(0, 200)
            .map(r => ({ id: r.id, name: r.name }));
        return {
            isNova,
            sections: replies2.get(g.id),
            legacy: isNova ? { all: replies.all(), custom: replies.overrides() } : null,
            roles,
            limits: { sections: replies2.MAX_SECTIONS, entries: replies2.MAX_ENTRIES, min: replies2.MIN_CONTAINS }
        };
    }));
    api.post('/rep2/section', hr(async (g, b, req) => {
        const act = String((b && b.act) || '');
        let extra = {};
        if (act === 'add') extra = { id: replies2.addSection(g.id, b) };
        else if (act === 'edit') extra = { section: replies2.editSection(g.id, String(b.id || ''), b.patch || b) };
        else if (act === 'del') extra = {};
        else if (act === 'move') extra = {};
        else throw new Error('طلب غير صالح');
        if (act === 'del') replies2.delSection(g.id, String(b.id || ''));
        if (act === 'move') replies2.moveSection(g.id, String(b.id || ''), b.dir === 'up' ? 'up' : 'down');
        const label = { add: 'قسم جديد', edit: 'تعديل قسم', del: 'حذف قسم', move: 'ترتيب الأقسام' }[act] || act;
        note(req, 'الردود: ' + label + ' — ' + g.name);
        return Object.assign({ ok: true, sections: replies2.get(g.id) }, extra);
    }));
    api.post('/rep2/entry', hr(async (g, b, req) => {
        const act = String((b && b.act) || '');
        const sid = String((b && b.sid) || '');
        if (act === 'add') replies2.addEntry(g.id, sid, b);
        else if (act === 'edit') replies2.editEntry(g.id, sid, String(b.eid || ''), b.patch || b);
        else if (act === 'del') replies2.delEntry(g.id, sid, String(b.eid || ''));
        else throw new Error('طلب غير صالح');
        const label = { add: 'إضافة رد', edit: 'تعديل رد', del: 'حذف رد' }[act] || act;
        note(req, 'الردود: ' + label + ' — ' + g.name);
        return { ok: true, sections: replies2.get(g.id) };
    }));
    api.post('/rep2/reset', hr(async (g, b, req) => {
        replies2.reset(g.id);
        note(req, 'الردود: تصفير كل أقسام ' + g.name);
        return { ok: true, sections: [] };
    }));

    api.get('/channels', h(async (g) => {
        await g.channels.fetch();
        return {
            channels: [...g.channels.cache.values()].filter(c => !c.isThread())
                .sort((a, b) => a.rawPosition - b.rawPosition)
                .map(c => ({ id: c.id, name: c.name, parentId: c.parentId, type: isCat(c) ? 'category' : c.isVoiceBased() ? 'voice' : 'text' }))
        };
    }));
    api.post('/channels/create', h(async (g, b, req) => {
        const name = clean(b.name);
        const type = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, category: ChannelType.GuildCategory }[b.type];
        if (!name || type === undefined) throw new Error('البيانات ناقصة');
        const o = { name, type };
        if (b.parentId && type !== ChannelType.GuildCategory) { const p = chan(g, b.parentId); if (!isCat(p)) throw new Error('القسم غير صالح'); o.parent = p.id; }
        const c = await g.channels.create(o);
        note(req, `إنشاء ${b.type === 'category' ? 'قسم' : 'روم'}: ${c.name}`);
    }));
    api.post('/channels/edit', h(async (g, b, req) => {
        const c = chan(g, b.id);
        if (b.name !== undefined) { if (!clean(b.name)) throw new Error('الاسم فاضي'); await c.setName(clean(b.name)); note(req, `تغيير اسم روم إلى: ${clean(b.name)}`); }
        if (b.parentId !== undefined && !isCat(c)) {
            if (b.parentId && !isCat(chan(g, b.parentId))) throw new Error('القسم غير صالح');
            await c.setParent(b.parentId || null, { lockPermissions: false });
            note(req, `نقل الروم ${c.name}`);
        }
    }));
    api.post('/channels/delete', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const c = chan(g, b.id);
        if (c.id === CONFIG.VOICE_CHANNEL_ID || c.id === botcontrol.get(g.id).voiceChannelId) throw new Error('هذا روم الفويس حق البوت، ما أحذفه');
        const n = c.name; await c.delete('من لوحة التحكم'); note(req, `حذف: ${n}`);
    }));

    // ===== التحكم بالبوت: الرومات المسموح فيها + تشغيل/تعطيل البوت + الروم الصوتي =====
    const voiceState = (g) => {
        const st = typeof client.voiceInfo === 'function' ? client.voiceInfo() : { inVoice: false, channelId: '' };
        const ch = st.channelId ? g.channels.cache.get(st.channelId) : null;
        return { inVoice: !!st.inVoice, channelId: st.channelId || '', channelName: ch ? ch.name : '' };
    };
    api.get('/bot', h(async (g) => {
        await g.channels.fetch();
        const cfg = botcontrol.get(g.id);
        const ch = [...g.channels.cache.values()].filter(c => !c.isThread());
        return {
            config: cfg,
            channels: ch.filter(c => c.type === ChannelType.GuildText).sort((a, b) => a.rawPosition - b.rawPosition)
                .map(c => ({ id: c.id, name: c.name, type: 'text', explicit: Object.prototype.hasOwnProperty.call(cfg.enabled, c.id), enabled: botcontrol.effective(g.id, c.id) })),
            voiceChannels: ch.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
                .sort((a, b) => a.rawPosition - b.rawPosition).map(c => ({ id: c.id, name: c.name })),
            voice: voiceState(g)
        };
    }));
    api.post('/bot/save', h(async (g, b, req) => {
        const saved = botcontrol.set(g.id, b);
        if ('voiceEnabled' in b || 'voiceChannelId' in b) botcontrol.applyVoice(g.id);
        note(req, 'تعديل إعدادات التحكم بالبوت');
        return { config: saved };
    }));
    api.post('/bot/channel', h(async (g, b, req) => {
        const c = chan(g, b.id);
        const enabled = botcontrol.toggleChannel(g.id, c.id, typeof b.value === 'boolean' ? b.value : undefined);
        note(req, `${enabled ? 'تفعيل' : 'تعطيل'} البوت في #${c.name}`);
        return { enabled };
    }));
    api.post('/bot/channels', h(async (g, b, req) => {
        if (b.mode === 'clear') { botcontrol.clearOverrides(g.id); note(req, 'تصفير تفعيلات البوت في الرومات'); return {}; }
        const ids = (Array.isArray(b.ids) ? b.ids : []).filter(id => g.channels.cache.has(String(id)));
        const n = botcontrol.setManyChannels(g.id, ids, !!b.value);
        note(req, `${b.value ? 'تفعيل' : 'تعطيل'} البوت في ${n} روم`);
        return { count: n };
    }));
    api.post('/bot/voice', h(async (g, b, req) => {
        const on = b.action === 'join';
        botcontrol.set(g.id, { voiceEnabled: on });
        botcontrol.applyVoice(g.id);
        note(req, on ? 'إدخال البوت الفويس' : 'إخراج البوت من الفويس');
        return { voice: voiceState(g) };
    }));

    api.get('/roles', h(async (g) => {
        await g.roles.fetch();
        return { roles: [...g.roles.cache.values()].filter(r => r.id !== g.id).sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? '#99aab5' : r.hexColor, editable: r.editable && !r.managed })) };
    }));
    api.post('/roles/create', h(async (g, b, req) => {
        const name = clean(b.name); if (!name) throw new Error('الاسم فاضي');
        const r = await g.roles.create({ name, color: hex(b.color) || '#99aab5', reason: 'من لوحة التحكم' });
        note(req, `إنشاء رتبة: ${r.name}`);
    }));
    api.post('/roles/edit', h(async (g, b, req) => {
        const r = role(g, b.id); if (!r.editable || r.managed) throw new Error('ما أقدر أعدل هذي الرتبة');
        const o = {}; if (b.name !== undefined && clean(b.name)) o.name = clean(b.name); if (b.color && hex(b.color)) o.color = b.color;
        await r.edit({ ...o, reason: 'من لوحة التحكم' }); note(req, `تعديل رتبة: ${r.name}`);
    }));
    api.post('/roles/delete', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const r = role(g, b.id);
        if (!r.editable || r.managed) throw new Error('ما أقدر أحذف هذي الرتبة');
        if (r.id === CONFIG.ROYAL_ROLE_ID) throw new Error('هذي الرتبة الملكية، محمية من الحذف');
        const n = r.name; await r.delete('من لوحة التحكم'); note(req, `حذف رتبة: ${n}`);
    }));

    // ===== رتب الألوان (Color Roles) =====
    const colorCfg = (g) => {
        const cfg = colors.get(g.id);
        const ch = cfg.channelId ? g.channels.cache.get(cfg.channelId) : null;
        return {
            channelId: cfg.channelId, channelName: ch ? ch.name : '', title: cfg.title, desc: cfg.desc,
            messageId: cfg.messageId, roles: cfg.roles
        };
    };
    const canManageRoles = (g) => !!(g.members.me && g.members.me.permissions.has('ManageRoles'));
    api.get('/colors', h(async (g) => {
        await g.channels.fetch();
        const mine = new Set(colors.get(g.id).roles.map(r => r.id));
        return {
            config: colorCfg(g),
            max: colors.MAX,
            clear: colors.clearStatus(),
            presets: colors.PRESETS.map(p => ({ key: p.key, name: colors.presetLabel(p), en: p.en, color: p.hex })),
            needPerm: !canManageRoles(g),
            channels: [...g.channels.cache.values()].filter(c => !c.isThread() && c.isTextBased() && !c.isVoiceBased())
                .sort((a, b) => a.rawPosition - b.rawPosition).map(c => ({ id: c.id, name: c.name })),
            guildRoles: [...g.roles.cache.values()].filter(r => r.id !== g.id && !r.managed && !mine.has(r.id))
                .sort((a, b) => b.position - a.position)
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? '#99aab5' : r.hexColor }))
        };
    }));
    api.get('/colors/stats', h(async (g) => colors.stats(g, g.id)));    api.get('/colors/clear/status', h(async () => ({ clear: colors.clearStatus() })));
    api.post('/colors/save', h(async (g, b, req) => {
        if (b.channelId) {
            const c = chan(g, b.channelId);
            if (!c.isTextBased() || c.isVoiceBased()) throw new Error('اختر روم نصي');
        }
        colors.set(g.id, b);
        note(req, 'حفظ إعدادات رتب الألوان');
        return { config: colorCfg(g) };
    }));
    api.post('/colors/add', h(async (g, b, req) => {
        const r = await colors.addRole(g, g.id, b);
        note(req, `إضافة لون: ${clean(b.name) || (b.roleId ? 'ربط رتبة موجودة' : '')}`);
        return { roles: r.roles };
    }));
    api.post('/colors/edit', h(async (g, b, req) => {
        const r = await colors.editRole(g, g.id, b);
        note(req, `تعديل لون${clean(b.name) ? ': ' + clean(b.name) : ''}`);
        return { roles: r.roles };
    }));
    api.post('/colors/delete', h(async (g, b, req) => {
        const r = await colors.delRole(g, g.id, b);
        note(req, b.deleteRole === true ? 'حذف رتبة لون نهائياً' : 'إزالة لون من قائمة الألوان');
        return { roles: r.roles, deleted: r.deleted };
    }));
    api.post('/colors/preset', h(async (g, b, req) => {
        const r = await colors.applyPreset(g, g.id, { deleteOld: b.deleteOld === true });
        note(req, `تجهيز الألوان الصريحة (${r.roles.length} لون • جديد ${r.created} • مصحّح ${r.fixed}${r.deleted ? ' • محذوف ' + r.deleted : ''})`);
        return { roles: r.roles, created: r.created, fixed: r.fixed, oldCount: r.oldCount, deleted: r.deleted, warn: r.warn };
    }));
    // صورة الألوان (Canvas) معاينة مباشرة بالداشبورد — يرسلها المتصفح مع كوكي الجلسة
    api.get('/colors/image.png', async (req, res) => {
        try {
            const gid = guildId(req);
            const g = gid ? client.guilds.cache.get(gid) : null;
            if (!g) return res.status(503).end();
            const buf = await colors.renderImage(colors.get(g.id));
            res.set('Content-Type', 'image/png').set('Cache-Control', 'no-store').send(buf);
        } catch (e) {
            res.status(400).json({ error: String(e.message || 'تعذر توليد الصورة').slice(0, 150) });
        }
    });
    // إعادة توليد صورة الألوان وإرسال/تحديث البانل
    api.post('/colors/image', h(async (g, b, req) => {
        const r = await colors.sendPanel(g, g.id, { resend: b.resend === true });
        note(req, `إعادة توليد صورة الألوان وإرسالها (${b.resend ? 'رسالة جديدة' : 'تحديث البانل'})`);
        return { messageId: r.messageId, channelId: r.channelId, edited: r.edited, count: colors.get(g.id).roles.length };
    }));
    api.post('/colors/panel', h(async (g, b, req) => {
        if (!canManageRoles(g)) throw new Error('البوت يحتاج صلاحية Manage Roles');
        const r = await colors.sendPanel(g, g.id, { resend: b.resend === true });
        note(req, r.edited ? 'تحديث بانل الألوان' : 'إرسال بانل الألوان');
        return { messageId: r.messageId, channelId: r.channelId, edited: r.edited };
    }));
    api.post('/colors/clear', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const j = colors.startClear(g, g.id, b);
        note(req, 'بدء إزالة شاملة لألوان السيرفر');
        return { clear: j };
    }));

    api.post('/announce', h(async (g, b, req) => {
        const c = chan(g, b.channelId);
        if (!c.isTextBased() || c.isVoiceBased()) throw new Error('اختر روم نصي');
        const text = String(b.text || '').trim().slice(0, 1800); if (!text) throw new Error('النص فاضي');
        const image = b.image !== false;
        // صورة المرسل + اسمه على البطاقة (لو ما قدرنا نجيبه نرسم بدون صورة)
        const me = await g.members.fetch(req.user.id).catch(() => null);
        const payload = await admin.announcePayload({
            title: clean(b.title) || '📢 إعلان ملكي', text, image, server: g.name,
            avatarURL: me ? me.displayAvatarURL({ extension: 'png', size: 256 }) : null,
            name: me ? me.displayName : req.user.name,
            footerBy: req.user.name
        });
        await c.send(payload);
        note(req, `إعلان في #${c.name}${image ? ' (صورة 🖼️)' : ' (نص)'}`);
    }));

    const mInfo = (m) => ({
        id: m.id, name: m.displayName, user: m.user.username, bot: m.user.bot, owner: owners.has(m.id),
        avatar: m.displayAvatarURL({ size: 64 }),
        timedOut: !!(m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now()),
        roles: [...m.roles.cache.values()].filter(r => r.id !== m.guild.id).map(r => ({ id: r.id, name: r.name }))
    });
    const getMember = (g, id) => g.members.fetch(String(id)).catch(() => { throw new Error('ما لقيت العضو بالسيرفر'); });

    api.get('/members/search', h(async (g, b, req) => {
        const q = String(req.query.q || '').trim();
        const id = (q.match(/\d{17,20}/) || [])[0];
        if (id) return { members: [mInfo(await getMember(g, id))] };
        if (process.env.MEMBERS_INTENT !== '1') throw new Error('البحث بالاسم غير مفعل: ابحث بالآي دي، أو أضف MEMBERS_INTENT=1');
        if (q.length < 2) throw new Error('اكتب حرفين على الأقل');
        return { members: [...(await g.members.search({ query: q, limit: 10 })).values()].map(mInfo) };
    }));

    api.post('/members/action', h(async (g, b, req) => {
        const m = await getMember(g, b.id);
        if (owners.has(m.id)) throw new Error('ما أمس الملوك 👑');
        if (m.id === client.user.id) throw new Error('ما أسوي هذا بنفسي');
        const why = clean(b.reason) || 'من لوحة التحكم';
        const no = (t) => { throw new Error(t); };
        switch (b.action) {
            case 'kick':
                if (b.confirm !== true) no('يحتاج تأكيد'); if (!m.kickable) no('ما أقدر أطرده (رتبته أعلى مني أو ما عندي صلاحية)');
                await m.kick(why); note(req, `طرد: ${m.user.username}`); break;
            case 'ban':
                if (b.confirm !== true) no('يحتاج تأكيد'); if (!m.bannable) no('ما أقدر أحظره (رتبته أعلى مني أو ما عندي صلاحية)');
                await g.members.ban(m.id, { reason: why }); note(req, `حظر: ${m.user.username}`); break;
            case 'timeout': {
                const mins = Number(b.minutes);
                if (!Number.isInteger(mins) || mins < 1 || mins > 40320) no('المدة من 1 إلى 40320 دقيقة');
                if (!m.moderatable) no('ما أقدر أكتمه (رتبته أعلى مني أو ما عندي صلاحية)');
                await m.timeout(mins * 60_000, why); note(req, `كتم ${m.user.username} لمدة ${mins} دقيقة`); break;
            }
            case 'untimeout':
                if (!m.moderatable) no('ما أقدر أعدل عليه'); await m.timeout(null, why); note(req, `فك كتم: ${m.user.username}`); break;
            case 'nick':
                if (!m.manageable) no('ما أقدر أغير لقبه'); await m.setNickname(clean(b.nick) || null, why); note(req, `تغيير لقب: ${m.user.username}`); break;
            case 'addrole': case 'removerole': {
                const r = role(g, b.roleId);
                if (!r.editable || r.managed) no('ما أقدر أتحكم بهذي الرتبة');
                if (b.action === 'addrole') await m.roles.add(r, why); else await m.roles.remove(r, why);
                note(req, `${b.action === 'addrole' ? 'إعطاء' : 'سحب'} رتبة ${r.name}: ${m.user.username}`); break;
            }
            default: no('إجراء غير معروف');
        }
    }));

    // تعديل نقاط لعبة أي عضو (حتى ارثر وإيدا نفسهم) — مقصود إنه ما يسجل كأمر ظاهر بديسكورد، بس من هنا
    api.post('/members/points', h(async (g, b, req) => {
        const m = await getMember(g, b.id);
        const amount = Number(b.amount);
        if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) throw new Error('رقم غير صالح');
        const doc = await points.add(g.id, m.id, amount);
        if (!doc) throw new Error('نظام النقاط غير متصل (قاعدة البيانات)');
        note(req, `${amount >= 0 ? '+' : ''}${amount} نقطة لعبة لـ ${m.user.username} (المجموع ${doc.points})`);
        return { points: doc.points };
    }));

    const target = async (g, id) => {
        const m = await g.members.fetch(String(id)).catch(() => null);
        if (!m) throw new Error('العضو مو موجود');
        if (owners.has(m.id)) throw new Error('ما أمس الملوك 👑');
        if (m.id === client.user.id) throw new Error('ما أقدر أسوي هذا بنفسي');
        return m;
    };
    api.get('/members', h(async (g, b, req) => {
        const list = await g.members.fetch({ query: String(req.query.q || '').slice(0, 32), limit: 25 })
            .catch(() => { throw new Error('فعّل Server Members Intent من موقع المطورين ثم أعد تشغيل البوت'); });
        return { members: [...list.values()].map(m => ({
            id: m.id, name: m.displayName, bot: m.user.bot, avatar: m.displayAvatarURL({ size: 64 }),
            roles: m.roles.cache.filter(r => r.id !== g.id).map(r => r.name).slice(0, 4)
        })) };
    }));
    api.post('/members/kick', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const m = await target(g, b.id); if (!m.kickable) throw new Error('رتبة البوت أقل من العضو');
        await m.kick('من لوحة التحكم'); note(req, `طرد: ${m.user.username}`);
    }));
    api.post('/members/ban', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const m = await target(g, b.id); if (!m.bannable) throw new Error('رتبة البوت أقل من العضو');
        await m.ban({ reason: 'من لوحة التحكم' }); note(req, `حظر: ${m.user.username}`);
    }));
    api.post('/members/timeout', h(async (g, b, req) => {
        const mins = Math.floor(Number(b.minutes));
        if (!(mins >= 0 && mins <= 40320)) throw new Error('المدة من 0 إلى 40320 دقيقة');
        const m = await target(g, b.id); if (!m.moderatable) throw new Error('ما أقدر أكتم هذا العضو');
        await m.timeout(mins ? mins * 60_000 : null, 'من لوحة التحكم');
        note(req, mins ? `ميوت ${mins} دقيقة: ${m.user.username}` : `فك ميوت: ${m.user.username}`);
    }));

    api.get('/welcome', h(async (g) => {
        await g.channels.fetch(); await g.roles.fetch();
        return {
            config: welcome.get(g.id),
            channels: [...g.channels.cache.values()].filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name })),
            roles: [...g.roles.cache.values()].filter(r => r.id !== g.id && !r.managed && r.editable)
                .sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name }))
        };
    }));
    api.post('/welcome/save', h(async (g, b, req) => { welcome.set(g.id, b); note(req, 'تعديل إعدادات الترحيب'); }));
    api.post('/welcome/test', h(async (g, b, req) => {
        const cfg = welcome.get(g.id);
        if (!cfg.channelId) throw new Error('اختر روم الترحيب واحفظ أول');
        const c = chan(g, cfg.channelId);
        const me = await g.members.fetch(req.user.id).catch(() => null);
        await c.send(await welcome.buildFull(cfg, {
            id: req.user.id, mention: `<@${req.user.id}>`,
            name: (me && me.displayName) || req.user.name, handle: me ? me.user.username : req.user.name,
            server: g.name, count: g.memberCount, members: g.memberCount,
            avatar: me ? me.displayAvatarURL({ size: 256 }) : ''
        }));
        note(req, 'تجربة رسالة الترحيب');
    }));

    // معاينة صورة الترحيب داخل اللوحة (بدون ما ترسل شي بالديسكورد)
    api.get('/welcome/preview', h(async (g, b, req) => {
        const me = await g.members.fetch(req.user.id).catch(() => null);
        const buf = await welcome.imageFor(welcome.get(g.id), {
            id: req.user.id, mention: `<@${req.user.id}>`,
            name: (me && me.displayName) || req.user.name, handle: me ? me.user.username : req.user.name,
            server: g.name, count: g.memberCount, members: g.memberCount,
            avatar: me ? me.displayAvatarURL({ size: 256 }) : ''
        });
        if (!buf) throw new Error('تعذّر توليد الصورة (تأكد من @napi-rs/canvas وملف Layla-Thuluth.ttf)');
        return { ok: true, image: 'data:image/png;base64,' + buf.toString('base64') };
    }));

    api.get('/tickets', h(async (g) => {
        await g.channels.fetch(); await g.roles.fetch();
        const ch = [...g.channels.cache.values()];
        return {
            config: tickets.get(g.id), open: tickets.openCount(g.id),
            categories: ch.filter(c => isCat(c)).map(c => ({ id: c.id, name: c.name })),
            channels: ch.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: '# ' + c.name })),
            roles: [...g.roles.cache.values()].filter(r => r.id !== g.id && !r.managed).sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name }))
        };
    }));
    api.post('/tickets/save', h(async (g, b, req) => { tickets.set(g.id, b); note(req, 'تعديل إعدادات التذاكر'); }));
    api.post('/tickets/panel', h(async (g, b, req) => {
        const c = chan(g, b.channelId);
        if (c.type !== ChannelType.GuildText) throw new Error('اختر روم نصي');
        await c.send(tickets.panelMessage(tickets.get(g.id)));
        note(req, `إرسال لوحة التذاكر في #${c.name}`);
    }));

    api.get('/jail', h(async (g) => {
        await g.channels.fetch(); await g.roles.fetch();
        const ch = [...g.channels.cache.values()];
        return {
            config: jail.get(g.id),
            channels: ch.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: '# ' + c.name })),
            voiceChannels: ch.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).map(c => ({ id: c.id, name: '🔊 ' + c.name })),
            roles: [...g.roles.cache.values()].filter(r => r.id !== g.id && !r.managed && r.editable)
                .sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name }))
        };
    }));
    api.post('/jail/save', h(async (g, b, req) => { jail.set(g.id, b); note(req, 'تعديل إعدادات السجن'); }));

    api.get('/trap', h(async (g) => {
        await g.channels.fetch();
        const ch = [...g.channels.cache.values()].filter(c => c.type === ChannelType.GuildText);
        return { config: trap.get(g.id), channels: ch.map(c => ({ id: c.id, name: '# ' + c.name })) };
    }));
    api.post('/trap/save', h(async (g, b, req) => {
        const saved = trap.set(g.id, b);
        note(req, `تعديل إعدادات روم الفخ (${saved.enabled ? 'مفعل' : 'معطل'})`);
    }));
    api.post('/jail/sync', h(async (g, b, req) => {
        const cfg = jail.get(g.id);
        if (!cfg.roleId) throw new Error('اختر رتبة السجن واحفظ أول');
        const r = await jail.syncAll(g, cfg);
        note(req, `مزامنة نظام السجن (${r.ok}/${r.total} روم)`);
        return r;
    }));

    // ===== الحماية (درع نوفا): إعدادات + قفل فوري + تنبيه تجريبي + سجل الحوادث =====
    api.get('/guard', h(async (g) => {
        await g.channels.fetch().catch(() => {});
        const cfg = guard.get(g.id);
        const me = g.members.me;
        const locks = store.read('guardlock.json', {});
        return {
            config: cfg,
            locked: locks[g.id] ? { at: locks[g.id].at, by: locks[g.id].by, reason: locks[g.id].reason || '', channels: Object.keys(locks[g.id].saved || {}).length } : null,
            channels: [...g.channels.cache.values()].filter(c => c.isTextBased && c.isTextBased() && !c.isThread?.())
                .map(c => ({ id: c.id, name: '# ' + c.name })),
            roles: [...g.roles.cache.values()].filter(r => r.id !== g.id && !r.managed)
                .sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name })),
            incidents: guard.incidents(g.id, 40),
            caps: {
                ban: me ? me.permissions.has('BanMembers') : false,
                kick: me ? me.permissions.has('KickMembers') : false,
                manageRoles: me ? me.permissions.has('ManageRoles') : false,
                manageChannels: me ? me.permissions.has('ManageChannels') : false,
                audit: me ? me.permissions.has('ViewAuditLog') : false,
                highest: me ? me.roles.highest.position : 0,
                total: g.roles.cache.size
            }
        };
    }));
    api.post('/guard/save', h(async (g, b, req) => {
        const cfg = guard.set(g.id, b);
        note(req, `تعديل إعدادات الحماية (${cfg.enabled ? 'مفعلة' : 'معطلة'} · عقوبة: ${cfg.mode})`);
        return { ok: true, config: cfg };
    }));
    api.post('/guard/reset', h(async (g, b, req) => {
        guard.reset(g.id);
        note(req, 'رجوع إعدادات الحماية للافتراضي');
        return { ok: true };
    }));
    api.post('/guard/lock', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const r = await guard.lockdown(g, !!b.on, { by: req.user.name, reason: 'قفل من لوحة التحكم' });
        note(req, b.on ? '🔒 قفل السيرفر فوراً (Panic)' : '🔓 فتح السيرفر');
        return r;
    }));
    api.post('/guard/test', h(async (g, b, req) => {
        const rep = await guard.notify(g, {
            title: 'هذا تنبيه تجريبي 🧪',
            lines: ['لو وصلتك هذي البطاقة، فالتنبيهات شغالة 100% ✅', `**أرسلها:** ${req.user.name}`, 'بترسل هنا تلقائياً أي محاولة تخريب بالجملة (حذف رومات/رتب، حظر أعضاء، رايد، سبام…).'],
            culprit: req.user.id, culpritName: req.user.name,
            stats: [{ label: 'الحالة', value: 'شغال' }]
        });
        // فحص قدرة البوت على قراءة سجل التدقيق (عليها تعتمد معرفة مين المخرب)
        try { await g.fetchAuditLogs({ limit: 1 }); rep.audit = '✅ يقرأ سجل التدقيق'; }
        catch (e) { rep.audit = '⛔ ما يقدر يقرأه: ' + e.message; }
        const me = g.members.me;
        const need = { BanMembers: 'حظر الأعضاء', ManageRoles: 'إدارة الرتب', ManageChannels: 'إدارة الرومات', ManageWebhooks: 'إدارة الويب هوكس', ModerateMembers: 'كتم الأعضاء' };
        rep.perms = me ? (Object.keys(need).filter(k => !me.permissions.has(k)).map(k => 'ناقص: ' + need[k]).join(' · ') || '✅ عنده كل الصلاحيات المطلوبة') : '⚠️ ما عرفت الصلاحيات';
        note(req, 'إرسال تنبيه حماية تجريبي');
        return { ok: true, report: rep };
    }));
    api.post('/guard/clear', h(async (g, b, req) => {
        guard.clearIncidents(g.id);
        note(req, 'تصفير سجل حوادث الحماية');
        return { ok: true };
    }));

    // ===== حالة البوت (Presence): حالات دوّارة + مرآة نشاط الملكيين — لسيرفرنا فقط =====
    api.get('/presence', hn(async (g) => {
        await g.channels.fetch().catch(() => {});
        return {
            config: presence.get(g.id),
            state: presence.status(),
            channels: [...g.channels.cache.values()].filter(c => c.isTextBased && c.isTextBased() && !c.isThread?.())
                .map(c => ({ id: c.id, name: '# ' + c.name }))
        };
    }));
    api.post('/presence/save', hn(async (g, b, req) => {
        const cfg = presence.set(g.id, b);
        presence.restartTimer();
        presence.apply();
        note(req, `تعديل حالة البوت (${cfg.enabled ? 'مفعلة' : 'معطلة'} · ${cfg.items.length} حالة · تبديل كل ${cfg.intervalSec} ثانية)`);
        return { ok: true, config: cfg, state: presence.status() };
    }));
    api.post('/presence/apply', hn(async (g, b, req) => {
        const st = presence.next();
        note(req, 'تطبيق حالة البوت فوراً');
        return { ok: true, state: st };
    }));
    api.post('/presence/reset', hn(async (g, b, req) => {
        presence.reset(g.id);
        presence.restartTimer();
        presence.apply();
        note(req, 'رجوع حالة البوت للافتراضي');
        return { ok: true, config: presence.get(g.id), state: presence.status() };
    }));

    // ===== 🎛️ لوحة التحكم: رسالة وحدة (بانر + قائمة خيارات) =====
    api.get('/hub', h(async (g) => {
        await g.channels.fetch().catch(() => {});
        return {
            config: hub.get(g.id),
            state: hub.state(g.id),
            catalog: hub.CATALOG,
            defaults: hub.DEF,
            channels: [...g.channels.cache.values()].filter(c => c.isTextBased && c.isTextBased() && !c.isThread?.())
                .map(c => ({ id: c.id, name: '# ' + c.name }))
        };
    }));
    api.get('/hub/image.png', async (req, res) => {
        try {
            const gid = guildId(req);
            const g = gid ? client.guilds.cache.get(gid) : null;
            if (!g) return res.status(503).end();
            const buf = await hub.renderImage(g);
            if (!buf) return res.status(400).json({ error: 'تعذر رسم بانر اللوحة (تأكد أن ملف art.js محدّث فيه panelCard)' });
            res.set('Content-Type', 'image/png').set('Cache-Control', 'no-store').send(buf);
        } catch (e) {
            res.status(400).json({ error: String(e.message || 'تعذر توليد صورة اللوحة').slice(0, 150) });
        }
    });
    api.post('/hub/save', h(async (g, b, req) => {
        const cfg = hub.set(g.id, b);
        note(req, `تعديل لوحة التحكم (${cfg.enabled ? 'مفعّلة' : 'مطفية'} · ${cfg.options.filter(o => o.on).length} خيار)`);
        return { ok: true, config: cfg, state: hub.state(g.id) };
    }));
    api.post('/hub/send', h(async (g, b, req) => {
        const r = await hub.send(g, g.id, { resend: b.resend === true });
        note(req, r.edited ? 'تحديث رسالة لوحة التحكم' : 'إرسال رسالة لوحة التحكم');
        return r;
    }));
    api.post('/hub/reset', h(async (g, b, req) => {
        hub.reset(g.id);
        note(req, 'رجوع لوحة التحكم للافتراضي');
        return { ok: true, config: hub.get(g.id), state: hub.state(g.id) };
    }));

    // ===== المستويات والرتب: معدلات الخبرة + المتصدرين + تعديل XP أي عضو =====
    api.get('/levels', h(async (g) => {
        const rows = await points.top(g.id, 25);
        const leaderboard = [];
        for (const d of rows) {
            const u = g.client.users.cache.get(d.userId) || await g.client.users.fetch(d.userId).catch(() => null);
            leaderboard.push({
                id: d.userId, name: u ? (u.globalName || u.username) : d.userId,
                avatar: u ? u.displayAvatarURL({ size: 64 }) : '',
                points: d.points || 0, textXp: d.textXp || 0, voiceXp: d.voiceXp || 0,
                totalLevel: points.levelOf(d.points || 0)
            });
        }
        return { config: levels.get(g.id), dbReady: points.ready(), leaderboard };
    }));
    api.post('/levels/save', h(async (g, b, req) => {
        const saved = levels.set(g.id, b);
        note(req, 'تعديل معدلات الخبرة (المستويات)');
        return { config: saved };
    }));
    api.get('/levels/member', h(async (g, b, req) => {
        const query = String(req.query.id || '').trim();
        const id = (query.match(/\d{17,20}/) || [])[0];
        let m = null;
        if (id) m = await g.members.fetch(id).catch(() => null);
        else if (process.env.MEMBERS_INTENT === '1' && query.length >= 2) {
            const list = await g.members.fetch({ query, limit: 1 }).catch(() => null);
            if (list && list.size) m = [...list.values()][0];
        }
        if (!m) throw new Error('ما لقيت العضو (جرّب الآي دي)');
        return {
            member: { id: m.id, name: m.displayName, avatar: m.displayAvatarURL({ size: 128 }) },
            profile: await points.profile(g.id, m.id)
        };
    }));

    // ملف حساب المستخدم المسجّل باللوحة نفسه (لزر "حسابي") — ما يحتاج بحث ولا MEMBERS_INTENT
    api.get('/levels/me', h(async (g, b, req) => {
        const id = req.user.id;
        const m = await g.members.fetch(id).catch(() => null);
        const u = m ? m.user : await g.client.users.fetch(id).catch(() => null);
        if (!u) throw new Error('ما لقيت حسابك في السيرفر');
        return {
            member: { id: u.id, name: (m && m.displayName) || u.globalName || u.username, avatar: u.displayAvatarURL({ size: 128 }) },
            profile: await points.profile(g.id, u.id)
        };
    }));
    api.post('/levels/edit', h(async (g, b, req) => {
        const m = await getMember(g, b.id);
        if (b.add !== undefined && b.points === undefined && b.textXp === undefined && b.voiceXp === undefined) {
            const amount = Math.floor(Number(b.add));
            if (!Number.isFinite(amount) || amount === 0) throw new Error('رقم غير صالح');
            const doc = await points.add(g.id, m.id, amount);
            if (!doc) throw new Error('نظام النقاط غير متصل (قاعدة البيانات)');
            note(req, `${amount >= 0 ? '+' : ''}${amount} XP لـ ${m.user.username}`);
            return { points: doc.points };
        }
        const doc = await points.setXp(g.id, m.id, { points: b.points, textXp: b.textXp, voiceXp: b.voiceXp });
        if (!doc) throw new Error('ما فيه قيم صالحة للتعديل');
        note(req, `تعديل XP العضو ${m.user.username} (إجمالي ${doc.points})`);
        return { points: doc.points };
    }));

    // ===== صفحة المحظورين: قائمة كل المحظورين بالسيرفر + فك الحظر =====
    api.get('/bans', h(async (g) => {
        const bans = await g.bans.fetch();
        const rec = store.read('trapbans.json', {});
        return {
            bans: [...bans.values()].map(b => ({
                id: b.user.id,
                name: b.user.username,
                display: b.user.globalName || b.user.username,
                reason: b.reason || '',
                trap: !!rec[b.user.id],
                at: rec[b.user.id] ? rec[b.user.id].at : 0
            })).sort((a, b) => (b.at || 0) - (a.at || 0) || a.name.localeCompare(b.name))
        };
    }));
    api.post('/bans/unban', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const id = String(b.id || '').trim();
        if (!/^\d{5,25}$/.test(id)) throw new Error('آيدي غير صالح');
        await g.members.unban(id, `فك حظر من لوحة التحكم (${req.user.name})`);
        const rec = store.read('trapbans.json', {});
        if (rec[id]) { delete rec[id]; store.write('trapbans.json', rec); }
        note(req, `فك حظر: ${id}`);
    }));

    // ===== الاقتصاد: الراتب اليومي + متجر الرتب + أرصدة الأعضاء =====
    const COIN = '🪙';
    const roleOpts = (g) => [...g.roles.cache.values()].filter(r => r.id !== g.id && !r.managed)
        .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name)).map(r => ({ id: r.id, name: r.name }));
    const shopName = (g, roleId) => { const r = g.roles.cache.get(roleId); return r ? r.name : roleId; };

    api.get('/economy', h(async (g) => {
        const shop = economy.shopFor(g.id).map(it => ({
            roleId: it.roleId, price: Number(it.price) || 0, name: shopName(g, it.roleId), exists: !!g.roles.cache.get(it.roleId)
        }));
        const raw = economy.balances(g.id);
        const rows = Object.keys(raw).map(id => ({
            id, balance: Math.max(0, Math.floor(Number(raw[id] && raw[id].balance) || 0)), last: Number(raw[id] && raw[id].lastDaily) || 0
        }));
        rows.sort((a, b) => b.balance - a.balance || a.id.localeCompare(b.id));
        const top = rows.slice(0, 10).map(u => {
            const m = g.members.cache.get(u.id);
            return { id: u.id, balance: u.balance, name: m ? m.displayName : ((client.users.cache.get(u.id) || {}).username || '') };
        });
        return {
            coin: COIN, daily: economy.daily(), shop, roles: roleOpts(g), top,
            total: rows.length, sum: rows.reduce((s, u) => s + u.balance, 0)
        };
    }));
    api.post('/economy/daily', h(async (g, b, req) => {
        const cfg = economy.setDaily(b);
        note(req, `تعديل الراتب اليومي: ${cfg.min}-${cfg.max} ${COIN} كل ${cfg.cdHours} ساعة`);
        return { daily: cfg };
    }));
    api.post('/economy/shop', h(async (g, b, req) => {
        const act = String(b.action || '');
        if (act === 'add') {
            const r = role(g, b.roleId);
            economy.shopAdd(g.id, r.id, b.price);
            note(req, `إضافة ${r.name} لمتجر الرتب`);
        } else if (act === 'price') {
            const it = economy.shopFor(g.id)[Number(b.index)];
            if (!it) throw new Error('العنصر مو موجود');
            economy.shopUpdate(g.id, b.index, b.price);
            note(req, `تعديل سعر ${shopName(g, it.roleId)} إلى ${Number(b.price)} ${COIN}`);
        } else if (act === 'remove') {
            const it = economy.shopFor(g.id)[Number(b.index)];
            if (!it) throw new Error('العنصر مو موجود');
            economy.shopRemove(g.id, b.index);
            note(req, `حذف ${shopName(g, it.roleId)} من المتجر`);
        } else if (act === 'move') {
            economy.shopMove(g.id, b.index, b.dir);
        } else throw new Error('إجراء غير معروف');
        return { shop: economy.shopFor(g.id) };
    }));
    api.get('/economy/member', h(async (g, b, req) => {
        const q = String(req.query.q || '').trim();
        const id = (q.match(/\d{17,20}/) || [])[0];
        let found = [];
        if (id) found = [await getMember(g, id)];
        else {
            if (process.env.MEMBERS_INTENT !== '1') throw new Error('البحث بالاسم غير مفعل: ابحث بالآي دي، أو أضف MEMBERS_INTENT=1');
            if (q.length < 2) throw new Error('اكتب حرفين على الأقل');
            found = [...(await g.members.search({ query: q, limit: 10 })).values()];
        }
        return {
            members: found.map(m => ({
                id: m.id, name: m.displayName, user: m.user.username,
                avatar: m.displayAvatarURL({ size: 64 }), balance: economy.get(g.id, m.id).balance
            }))
        };
    }));
    api.post('/economy/balance', h(async (g, b, req) => {
        const m = await getMember(g, b.id);
        const amount = Number(b.amount);
        if (!Number.isInteger(amount) || Math.abs(amount) > 1000000000) throw new Error('رقم غير صالح');
        const doc = b.set ? economy.setBalance(g.id, m.id, amount) : economy.addBalance(g.id, m.id, amount);
        note(req, `${b.set ? 'تعيين' : (amount >= 0 ? 'إضافة' : 'خصم')} ${Math.abs(amount)} ${COIN} لـ ${m.user.username} (صار ${doc.balance})`);
        return { balance: doc.balance };
    }));

    // ===== القرعات: بدء/إنهاء/إلغاء/إعادة سحب (نفس نظام /قرعة_بدء) =====
    const gwChan = (g, id) => {
        const c = chan(g, id);
        if (!c.isTextBased() || c.isVoiceBased()) throw new Error('اختر روم نصي');
        return c;
    };
    const uName = (g, id) => { const m = g.members.cache.get(id); return m ? m.displayName : ((client.users.cache.get(id) || {}).username || id); };

    api.get('/giveaway', h(async (g) => {
        await g.channels.fetch();
        const all = giveaway.list();
        const rows = Object.keys(all).map(id => Object.assign({ id }, all[id]));
        const chName = (id) => { const c = g.channels.cache.get(id); return c ? c.name : 'روم محذوف'; };
        const active = rows.filter(w => !w.ended).sort((a, b) => a.endsAt - b.endsAt).map(w => ({
            id: w.id, prize: w.prize, endsAt: w.endsAt, channel: chName(w.channelId), winnersCount: w.winners,
            entrants: (w.entrants || []).length, sample: (w.entrants || []).slice(0, 6).map(id => uName(g, id))
        }));
        const ended = rows.filter(w => w.ended).sort((a, b) => (b.wonAt || b.endsAt) - (a.wonAt || a.endsAt)).slice(0, 8).map(w => ({
            id: w.id, prize: w.prize, endsAt: w.endsAt, channel: chName(w.channelId),
            entrants: (w.entrants || []).length, wonNames: (w.wonIds || []).map(id => uName(g, id))
        }));
        return {
            active, ended,
            channels: [...g.channels.cache.values()].filter(c => c.type === ChannelType.GuildText)
                .sort((a, b) => a.rawPosition - b.rawPosition).map(c => ({ id: c.id, name: c.name }))
        };
    }));
    api.post('/giveaway/start', h(async (g, b, req) => {
        const c = gwChan(g, b.channelId);
        const r = await giveaway.launch(client, c, { prize: b.prize, winners: b.winners, mins: b.minutes, by: req.user.name });
        note(req, `بدء قرعة «${String(b.prize || '').slice(0, 40)}» في #${c.name}`);
        return r;
    }));
    api.post('/giveaway/end', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const w = giveaway.list()[String(b.id)];
        if (!w) throw new Error('ما لقيت القرعة (يمكن انحذفت)');
        await giveaway.end(client, b.id);
        note(req, `إنهاء قرعة «${String(w.prize || '').slice(0, 40)}»`);
    }));
    api.post('/giveaway/cancel', h(async (g, b, req) => {
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        const w = giveaway.list()[String(b.id)] || {};
        await giveaway.cancel(client, b.id);
        note(req, `إلغاء قرعة «${String(w.prize || '').slice(0, 40)}»`);
    }));
    api.post('/giveaway/reroll', h(async (g, b, req) => {
        const w = giveaway.list()[String(b.id)] || {};
        const winners = await giveaway.reroll(client, b.id);
        note(req, `إعادة سحب قرعة «${String(w.prize || '').slice(0, 40)}» (${winners.length} فائز)`);
        return { winners: winners.length };
    }));

    // ===== 🌐 السيرفرات (فوق الكل فقط): مين البوت شغال فيه ومين مقفول =====
    const rootOnly = (fn) => async (req, res) => {
        const s = session(req);
        if (!s || !access.isSuper(s.id, CONFIG)) return res.status(403).json({ error: 'هذي الصفحة خاصة بصاحب البوت فقط 👑' });
        try { return await fn(s, req, res); }
        catch (e) { res.status(400).json({ error: String(e.message || 'خطأ').slice(0, 150) }); }
    };
    api.get('/guilds', rootOnly(async (s, req, res) => {
        const arr = [...client.guilds.cache.values()].map(g => ({
            id: g.id, name: g.name, icon: g.iconURL({ size: 64 }) || '',
            members: g.memberCount || 0, ownerId: g.ownerId,
            approved: access.isApproved(g.id, CONFIG),
            nova: String(g.id) === String(CONFIG.GUILD_ID),
            allowed: access.list(g.id).length
        })).sort((a, b) => (b.members || 0) - (a.members || 0));
        res.json({ guilds: arr, total: arr.length, active: arr.filter(x => x.approved).length });
    }));
    api.post('/guilds/approve', rootOnly(async (s, req, res) => {
        const gid = String((req.body && req.body.id) || '').trim();
        const on = !!(req.body && req.body.on);
        const g = client.guilds.cache.get(gid);
        if (!g) return res.status(400).json({ error: 'السيرفر مو موجود (البوت مو فيه)' });
        if (String(gid) === String(CONFIG.GUILD_ID) && !on) return res.status(400).json({ error: 'سيرفر نوفا ما ينقفل أبداً' });
        access.approve(gid, on, s.id, g.name);
        // 🔁 نزامن الأوامر فوراً: مفعّل → تنزل · مقفول → تنمسح
        try { if (typeof client.syncGuildCommands === 'function') await client.syncGuildCommands(g); } catch {}
        const l = store.read('dashlog.json', []);
        l.unshift({ at: Date.now(), by: s.name, gid, msg: (on ? '🔓 تفعيل السيرفر: ' : '🔒 قفل السيرفر: ') + g.name });
        store.write('dashlog.json', l.slice(0, 300));
        res.json({ ok: true, id: gid, approved: on });
    }));

    // ===== 🔑 صلاحية الدخول للوحة: من يدخل لوحة هذا السيرفر (أنا اللي أعطيها) =====
    api.get('/access', h(async (g, b, req) => {
        const s = session(req);
        return {
            list: access.list(g.id),
            canManage: access.canManage(g, s.id, CONFIG),
            isSuper: access.isSuper(s.id, CONFIG),
            nova: access.isNova(g.id, CONFIG),
            approved: access.isApproved(g.id, CONFIG),
            ownerId: g.ownerId,
            guild: { id: g.id, name: g.name, icon: g.iconURL({ size: 64 }) || '' },
            superIds: access.superIds(CONFIG)
        };
    }));
    // بحث عن عضو بالاسم (عشان ما تكتب الآيدي يدوي)
    api.get('/access/find', h(async (g, b, req) => {
        const s = session(req);
        if (!access.canManage(g, s.id, CONFIG)) throw new Error('ما عندك صلاحية تعديل قائمة الدخول لهذا السيرفر');
        const q = String(req.query.q || '').trim();
        if (q.length < 2) return { found: [] };
        let found = [];
        try {
            const res2 = g.members.cache.filter(m => {
                const n = (m.user.globalName || m.user.username || '').toLowerCase();
                return n.includes(q.toLowerCase()) || m.id.startsWith(q);
            });
            found = [...res2.values()].slice(0, 10);
            if (!found.length && typeof g.members.fetch === 'function') {
                // بحث مباشر من ديسكورد (يشتغل لما يكون Server Members Intent مفعّل)
                const r = await g.members.fetch({ query: q, limit: 10 }).catch(() => null);
                if (r) found = [...r.values()];
            }
        } catch { found = []; }
        return { found: found.map(m => ({ id: m.id, name: m.user.globalName || m.user.username, bot: m.user.bot })) };
    }));
    api.post('/access/add', h(async (g, b, req) => {
        const s = session(req);
        if (!access.canManage(g, s.id, CONFIG)) throw new Error('ما عندك صلاحية تعديل قائمة الدخول لهذا السيرفر');
        const id = String((b && b.id) || '').replace(/[^\d]/g, '');
        if (!id) throw new Error('حط آيدي الحساب (أو ابحث بالاسم)');
        const u = await client.users.fetch(id).catch(() => null);
        const list = access.add(g.id, id, u ? (u.globalName || u.username) : '', s.id);
        note(req, `إعطاء صلاحية دخول اللوحة: ${u ? (u.globalName || u.username) : id}`);
        return { ok: true, list };
    }));
    api.post('/access/remove', h(async (g, b, req) => {
        const s = session(req);
        if (!access.canManage(g, s.id, CONFIG)) throw new Error('ما عندك صلاحية تعديل قائمة الدخول لهذا السيرفر');
        const id = String((b && b.id) || '').replace(/[^\d]/g, '');
        if (!id) throw new Error('طلب غير صالح');
        const list = access.remove(g.id, id);
        note(req, `سحب صلاحية دخول اللوحة: ${id}`);
        return { ok: true, list };
    }));
    api.post('/access/clear', h(async (g, b, req) => {
        const s = session(req);
        if (!access.canManage(g, s.id, CONFIG)) throw new Error('ما عندك صلاحية تعديل قائمة الدخول لهذا السيرفر');
        if (b.confirm !== true) throw new Error('يحتاج تأكيد');
        access.clear(g.id);
        note(req, 'تصفير قائمة المسموحين بالدخول');
        return { ok: true, list: [] };
    }));

    // أي مسار API غير معروف يرجّع JSON وليس صفحة HTML (كان يرجّع HTML 404 لما تكون الجلسة صالحة => يطلع خطأ «Unexpected token '<'» بالمتصفح)
    api.use((req, res) => {
        console.error('⚠️ مسار API غير معروف:', req.method, req.originalUrl);
        res.status(404).json({ error: 'مسار غير معروف: ' + req.path });
    });
    // أي خطأ بالطلب نفسه (JSON مكسور، حجم كبير) يرجّع JSON كذلك
    api.use((err, req, res, next) => {
        console.error('⚠️ خطأ بالطلب:', req.method, req.originalUrl, err && err.message);
        res.status((err && err.status) || 400).json({ error: 'طلب غير صالح: ' + String((err && err.message) || '').slice(0, 120) });
    });

    app.use('/dashboard/api', api);
};
