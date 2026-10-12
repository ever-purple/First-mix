(() => {
  const match = location.pathname.match(/course-(0[0-3])-(?:interaction-script|playable)\.html$/);
  if (!match) return;
  const course = match[1];
  const concepts = {
    "00": [
      ["PLAY｜播放", "让当前唱片从播放头所在位置开始或暂停。它只控制这一侧，不会自动播放另一首。", "模型动作：按下对应 Deck 的 PLAY。"],
      ["Cue｜返回起点", "保存一个准备开始的位置。播放后按 Cue，会回到这个位置并暂停。", "模型动作：按 Cue；不是耳机预听键。"],
      ["Crossfader｜交叉推子", "决定声音偏向 A 还是 B。左侧只听 A，右侧只听 B，中间可以同时听见两边。", "模型动作：按住推子帽横向推动。"]
    ],
    "01": [
      ["播放头", "屏幕上当前会从哪里开始播放的位置。转动唱盘时，播放头会随音乐前后移动。", "先转唱盘找到位置，再保存 Cue。"],
      ["Cue 点", "你亲手保存的开始位置。它像书签，不会改变歌曲本身，也不是耳机监听。", "在目标位置暂停后按 Cue 保存。"],
      ["唱盘定位", "暂停时前后转动唱盘，可以细找一个字、一个鼓点或一句旋律的开头。", "模型动作：沿唱盘盘面拨动。"]
    ],
    "02": [
      ["拍 Beat", "音乐中持续、稳定的脉搏。数拍时跟着底鼓最容易，但拍并不等于只数底鼓。", "听法：1、2、3、4 循环。"],
      ["第一拍 Downbeat", "每个小节重新开始的第 1 拍，通常比后面三拍更有起点感。", "本课要连续找到多个小节的第一拍。"],
      ["小节 Bar", "常见舞曲里，4 拍组成 1 小节。小节帮助你描述短距离，不等于完整的一句音乐。", "结构：4 拍 = 1 小节。"],
      ["乐句 Phrase", "多个小节组成的一段完整音乐表达，像一句话。转场通常从新乐句第一拍开始。", "本课结构：4 小节 = 1 个练习乐句。"]
    ],
    "03": [
      ["BPM｜速度", "每分钟有多少拍。数字越大，音乐通常越快；它描述速度，不代表两首歌已经踩在同一拍上。", "模型位置：每个 Deck 的 BPM 显示。"],
      ["Sync｜速度同步", "让 B 的 BPM 自动跟随 A。Sync 先统一速度，但不会替你选择正确乐句或完成转场。", "模型动作：按下 B 的 SYNC。"],
      ["拍点对齐", "两首速度一样后，还要让每一拍同时落下。若一边稍早或稍晚，需要轻推或回拉唱盘。", "模型动作：短暂推拉唱盘，不改变目标 BPM。"]
    ]
  }[course];
  if (!concepts || document.querySelector('[data-concept-highlight]')) return;

  const style = document.createElement('style');
  style.textContent = `
    .fm-concepts{margin:18px auto;padding:24px;border:1px solid rgba(23,19,29,.09);border-radius:26px;background:rgba(251,250,244,.94);box-shadow:0 16px 46px rgba(58,40,73,.1);font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}
    .fm-concepts__head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:18px}.fm-concepts__head h2{margin:0;font-size:23px}.fm-concepts__head p{margin:0;color:#756d79;font-size:12px}
    .fm-concepts__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:11px}.fm-concept{padding:19px;border:2px solid #7750cf;border-radius:18px;background:#eee8fa}.fm-concept__badge{display:inline-block;margin-bottom:13px;padding:5px 8px;border-radius:999px;background:#7750cf;color:#fff;font-size:9px;font-weight:800;letter-spacing:.08em}.fm-concept h3{margin:0 0 7px;font-size:17px}.fm-concept p{margin:0;color:#59515e;font-size:12px;line-height:1.55}.fm-concept strong{display:block;margin-top:10px;color:#7750cf}
    @media(max-width:620px){.fm-concepts{padding:20px 16px;border-radius:22px}.fm-concepts__head{display:block}.fm-concepts__head p{margin-top:6px}.fm-concepts__grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const section = document.createElement('section');
  section.className = 'fm-concepts';
  section.dataset.conceptHighlight = course;
  section.innerHTML = `<header class="fm-concepts__head"><h2>新概念先认识</h2><p>第一次操作前先说明：是什么、在哪里、怎么动</p></header><div class="fm-concepts__grid">${concepts.map(([title, body, action]) => `<article class="fm-concept"><span class="fm-concept__badge">NEW 新概念</span><h3>${title}</h3><p>${body}<strong>${action}</strong></p></article>`).join('')}</div>`;

  const main = document.querySelector('main') || document.body;
  const question = main.querySelector('.question-preview, .question-stage, [class*="question"], .hero');
  if (question && question.parentElement === main) question.insertAdjacentElement('afterend', section);
  else main.insertAdjacentElement('afterbegin', section);
})();
