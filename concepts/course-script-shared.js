const courses = [
  ["00", "第一次交接"], ["01", "设置开始位置"], ["02", "听懂音乐结构"],
  ["03", "让两首歌对齐"], ["04", "在正确时间接入"], ["05", "让转场保持清晰"],
  ["06", "选择短交接或长混合"], ["07", "独立完成与 AI 评分"]
];

const scripts = {
  "04": {
    title: "在正确时间接入",
    question: "B 已经对齐，为什么一放进来还是像打断了 A？",
    lead: "把上一课的“速度一致”接到真正的音乐时机：先听完整乐句，再让 B 从下一句开头进入。",
    goal: "在乐句边界让 B 进入",
    goalNote: "用户要听见一次明显的“接得上”，而不是只按中一个发光按钮。",
    guardrails: [["操作真实控件", "核心动作必须发生在仿真打碟机：按 PLAY、转动唱盘、拖动推子，不用答案按钮代替。"], ["先听后看", "第一遍不显示小节答案；第二遍才给轻量结构提示。"], ["试听不拖长", "完整听一轮即可进入操作，可跳过，不提供重复结构试听。"]],
    flow: ["问题出现", "听错与对", "找下一句", "准备 B", "按时接入", "确认结果"],
    prompt: "什么时候放入 B，才不会打断 A 正在说完的这一句？",
    promptBody: "先听 A 的乐句走完，再让 B 从下一句第一拍开始。这里学的是“句子何时结束”，不是抢着按键。",
    promptAction: "听两个版本",
    sound: [["不合格示范", "B 在 A 的乐句中间进入；即使速度相同，也会听到结构被截断。"], ["正确示范", "B 从下一句第一拍进入；旋律与鼓组像完成一次自然换句。"]],
    concepts: [["推拉微调 Beat Nudge", "歌曲已经开始播放时，短暂推快或拖慢唱盘，让两首歌的拍点重新重合。它只修正位置，不重新改变整首歌的目标速度。", "模型动作：轻推唱盘向前，轻拉唱盘向后。"]],
    steps: [
      ["先听完整乐句", "建立一句音乐的整体印象。", "试听", "仅突出播放与进度，不显示答案。", "播放 A 一轮 16 拍；用户只听，不需点击。", "完整播放结束后自动进入下一步。", "提示：先别数，注意音乐什么时候像“说完一句”。"],
      ["比较提前与正确接入", "让差异足够明显。", "对比", "两个大按钮：句中进入 / 句首进入。", "依次播放两个 8 秒版本；第二次播放前留 500ms 间隔。", "两个版本都播放过即可。", "反馈不说“对错”，只指出哪一个打断了原句。"],
      ["找到下一句的第一拍", "把听感变成唱盘上的位置。", "转唱盘", "突出 A 唱盘外缘；波形只显示当前乐句与下一句边界。", "A 暂停后，用手指左右转动 A 唱盘寻找新一句第一拍，听到起音后停住。", "唱针停在目标第一拍 ±0.25 拍，松手后位置保持。", "转过头可直接反向回拨；反馈显示“再向前一点 / 再向后一点”，不让用户点答案。"],
      ["把 B 准备在起点", "使用与仿真模型一致的准备动作。", "转动 + 按压", "突出 B 唱盘、Cue 和已开启的 Sync 状态。", "转动 B 唱盘确认起音，再按 Cue 回到已设位置；B 保持暂停。", "B 回到 Cue ±0.1 拍，Sync 开启，播放保持暂停。", "若位置不符，允许继续转动唱盘；不自动替用户复位。"],
      ["在下一句接入 B", "完成本课核心动作。", "按压 + 微调", "突出实体 PLAY B 与 B 唱盘外缘；A 持续播放。", "在下一句第一拍按下 PLAY B；若两拍略有偏移，用手指轻推或回拉 B 唱盘修正。", "初次接入误差 ≤0.5 拍，微调后 ≤0.2 拍。", "成功后隐藏辅助线；失败只回退 1 小节，并提示该向前推还是向后拉。"],
      ["听完一次自然换句", "用声音验证而非只看判定。", "验证", "无高亮，结构提示渐隐。", "继续播放 8 拍，用户选择“接得上 / 被打断”。", "系统判定通过且用户选择“接得上”。", "若感受与系统不同，保留结果并允许直接再听操作段。"]
    ],
    completion: "你已让 B 在 A 说完一句后进入。",
    completionBody: "完成内容：听出下一句、准备 B、在乐句边界接入。下一课会处理两首同时播放时的浑浊与音量问题。",
    next: "05 让转场保持清晰",
    notes: ["音乐要求：A 的 16 拍乐句边界清楚，前 8 拍不要有人声抢拍；B 有容易识别的开头。", "优先从混搭试听实验或跨文化参考池挑选“结构清楚”的组合；不适配就换，不为引用参考池而硬凑。", "再做一次直接回到步骤 03，不再弹出问题卡。"]
  },
  "05": {
    title: "让转场保持清晰",
    question: "拍点已经对上，为什么两首叠起来还是会浑、还会突然变大？",
    lead: "04 的成果由系统自动整理频段；这一课换用户亲手匹配音量、准备 B 的低频，并在 16 拍内把低频和声音重心交给 B。",
    goal: "完成一段不中断、无削波的 24 秒清晰交接",
    goalNote: "只新增 GAIN 与 LOW；Crossfader 已在 00 学过，本课直接复用。",
    guardrails: [["只介绍新概念", "依次框住真实混音器上的 GAIN 与 LOW，不重复介绍 Crossfader。"], ["声音和读数一致", "旋钮参数、电平表、削波判定与听感来自同一条真实音频链。"], ["连续手势", "旋钮沿圆周转动，Crossfader 横向拖动，点击轨道不能瞬移。"], ["B 接入前静音", "GAIN 阶段 B 只进入预听电平表，不送入主输出；直到目标第一拍才真正进入混音。"]],
    flow: ["认识新控件", "听两个版本", "匹配音量", "B LOW 降低", "LOW 交换", "推向 B"],
    prompt: "拍点已经对上，为什么两首叠起来还是会浑？",
    promptBody: "两首歌的底鼓与贝斯同时占满低频，总音量也会叠高。先匹配音量，再让低频只由一首歌主导。",
    promptAction: "学习频段交接",
    sound: [["浑浊版本", "同一段、同一响度下让 A、B 低频同时全开。"], ["清晰版本", "B 收低频进入，用 16 拍把 LOW 和声音重心交给 B。"]],
    concepts: [
      ["GAIN｜通道增益", "控制歌曲进入混音器前的基础音量。先让 A、B 实测短时平均电平接近，不用它做表演淡入。", "模型位置：每个通道顶部的 GAIN 旋钮。"],
      ["LOW｜低频", "控制底鼓与贝斯。两首叠加时让 LOW 只由一边主导，鼓点才不会糊。", "模型位置：每个通道 EQ 区的 LOW 旋钮。"]
    ],
    steps: [
      ["认识 GAIN 与 LOW", "先知道两个新旋钮各管什么。", "看真实控件", "依次框住 B GAIN 与 A/B LOW，不重复框 Crossfader。", "观察高亮与短声音示例后继续。", "两个区域都完成介绍。", "GAIN 示例改变基础音量；LOW 示例只改变底鼓与贝斯。"],
      ["先听两个版本", "辨认浑浊和清楚。", "响度匹配试听", "控件置灰，拍子标尺保持同步。", "连续听 16 拍浑浊版和 16 拍清晰版；总长约 21 秒，可跳过且跳过后控件立即恢复。", "两版听完或主动跳过。", "版本间不留空；不播放整首歌，只改变真实 GAIN、LOW 和 Crossfader 自动化。"],
      ["匹配基础音量", "让 B 与固定参考 A 接近。", "转 B GAIN", "标出 A 是参考、B 是调整；主输出只有 A，B 仅供预听测量。", "系统用代表性 32 拍片段统一素材基准并显示固定目标，再沿圆周把 B GAIN 从 +4.0 dB 调到 0.0 dB。", "B GAIN 进入 -0.5 至 +0.5 dB 并保持 1 秒；真实电平表同步接近 A。", "片段约 21 秒循环，不播放整首歌；稳定后停止并显示下一步。"],
      ["让 B 收低频进入", "先给 B 腾出低频空间。", "转 LOW + 看拍子按 PLAY", "B LOW 到位后开放紫色 PLAY B；只有上方当前拍变绿，按钮不随第一拍改变颜色。", "标尺从 13→14→15→16→1 连续跳动，用户观察第 1 格亮起后自行按 PLAY B。", "点击瞬间读取标尺唯一的当前拍；显示为 1 就通过，不再用第二套时间差重复判定。", "按在其他拍会显示具体拍号并回到第 13 拍；沿用 04 的 Cue、Sync。"],
      ["用 16 拍交换低频", "把底鼓从 A 平稳交给 B。", "转动两个 LOW", "1–8 拍高亮 A LOW 逆时针，9–16 拍切换为 B LOW 顺时针。", "先 A LOW 0→-12 dB，再 B LOW -12→0 dB。", "第 8 拍 A≤-12 dB；第16拍 B 在±1.5 dB；两边不得同时高于-6 dB且总线不削波。", "只循环失败的 8 拍，保留已完成旋钮位置。"],
      ["把声音交给 B 并回听", "完成推子交接，听满成果。", "推 Crossfader", "先高亮推子帽和 B 端，到位后撤掉全部高亮。", "至少用 4 拍把推子从中央持续推到 B，再听完 24 秒成果。", "第 8 拍位置≥90% B；B 稳定、无削波；成果播放满24秒。", "点击轨道无效；回听使用刚才记录的真实自动化，不用预制答案。"]
    ],
    completion: "低频已经平稳交给 B。",
    completionBody: "完成内容：实测匹配 GAIN、让 B 收低频进入、用 16 拍交换 LOW，并把声音重心送到 B。",
    next: "06 选择短交接或长混合",
    notes: ["继续使用 04 的 Nujabes〈Beat Laments the World〉与黄金年代《十年》，沿用已确认的 Cue、Sync 与拍点。", "失败就近重试，不让用户重新等待整段。", "统一响度：目标 -16 LUFS-I，峰值不超过 -1 dBTP。", "再做一次直接回到步骤 02。"]
  },
  "06": {
    title: "选择短交接或长混合",
    question: "怎么判断两首歌该用 16 拍短交接，还是 32 拍长混合？",
    lead: "固定 A《まどろみ》，比较 B1《我只在乎你》和 B2《All Night》。两种流程都讲清楚；只引导完成 A＋B2 的 32 拍长混合，A＋B1 的完整短交接留到 07。",
    goal: "会判断并说出两种流程，再完成 A＋B2 的 32 拍长混合",
    goalNote: "速度接近只是接拍前提；转场长短由乐句空间、主线、和声、律动与能量决定。",
    guardrails: [["两种流程都说明", "16拍与32拍都用同步拍子、动作顺序和真实声音讲清；完整引导只开放A＋B2。"], ["先给判断规则", "答案出现前依次检查乐句空间、主线、和声、律动与能量，不能只凭曲风或速度决定。"], ["练习不重复", "06完成A＋B2长混合；07再用A＋B1完成短交接。"]],
    flow: ["学习判断顺序", "比较 B1 / B2", "看 16 拍流程", "看 32 拍流程", "引导 A＋B2", "总结并进入 07"],
    prompt: "先判断能不能共存，再决定转场要多长。",
    promptBody: "没有完整32拍空间，或人声、主旋律、和声明显冲突，就用16拍；四项都能共存才用32拍。本课用A＋B2练长混合。",
    promptAction: "学习判断与流程",
    sound: [["16 拍短交接", "A《まどろみ》→B1《我只在乎你》：缩短两条主线同时出现的时间。"], ["32 拍长混合", "A《まどろみ》→B2《All Night》：让相容的律动与和声逐步交接。"]],
    concepts: [
      ["判断规则", "依次检查 32 拍乐句空间、主线冲突、和声稳定、律动与能量。空间不足或主线、和声明显冲突就短接；四项都适合共存才长混。", "同一个 A，分别判断 B1 与 B2。"],
      ["短交接｜16 拍顺序", "准备 B → B 收低频进入 → A 低频与主线退出 → B 恢复低频并接管。", "用 16 格拍子标尺演示，不要求实际操作。"],
      ["长混合｜32 拍顺序", "准备 32 拍 → B 收低频进入 → 两首共存 → 交换 LOW → 推到 B 并在句尾退出 A。", "用 32 格拍子标尺演示，不要求实际操作。"]
    ],
    steps: [
      ["学习判断顺序", "先知道应该听什么，再做选择。", "判断路径", "依次显示32拍空间、主线、和声、律动与能量；每项同时提供文字和声音。", "听四项对比并选择冲突或可共存。", "说出短接触发条件和长混必须满足的条件。", "错误时重放对应4拍并解释听点。"],
      ["比较 A＋B1 与 A＋B2", "用同一套规则听出不同关系。", "听 + 看结构", "同响度依次播放两组，分别标出冲突处与可共存处。", "为两组检查五项依据，再选择短或长。", "B1=16拍并指出冲突；B2=32拍并指出完整空间或律动相容。", "只回放对应冲突4拍或可共存8拍。"],
      ["看懂16拍短交接顺序", "先学会B1在07要怎么接。", "16拍动画 + 顺序卡", "1–8拍B收低频进入；9–12拍A低频与主线退出；13–16拍恢复B低频并推到B。", "观看动画并排列四张动作卡，不实际操作A＋B1。", "准备B→B进入→A退出→B接管。", "排错只重放相邻4拍。"],
      ["看懂32拍长混合顺序", "知道接下来引导练习的完整路线。", "32拍动画 + 顺序卡", "1–8拍B2收低频进入；9–16拍共存；17–24拍交换LOW；25–32拍推到B2并退出A。", "观看动画并排列五张动作卡。", "准备→B2进入→共存→LOW交换→A退出。", "排错只重放错误相邻阶段。"],
      ["跟随引导完成A＋B2", "把32拍顺序完整做一遍。", "32拍真实引导", "每8拍只开放当前控件：启动B2、保持共存、交换LOW、推向B2。", "第1拍启动B2；按四段完成B2 LOW、A LOW与Crossfader。", "启动≤±0.25拍；第24拍A LOW≤-12dB、B2 LOW在±1.5dB；第32拍推子≥90%B2；无削波。", "失败只循环当前8拍并保留前面结果。"],
      ["回听并带走两套流程", "确认06练长混合，07再练短交接。", "成果 + 方案卡", "显示A＋B2结果时间线；保留B1卡并标注07完整练习。", "听完成果并复述两种判断与流程。", "A＋B2回听完成；两种理由与顺序正确。", "B1不在06提前实操。"]
    ],
    completion: "你已经会判断，并完成了一次长混合。",
    completionBody: "你用A＋B2完成了32拍长混合。B1的16拍顺序已经讲清，下一课再用A＋B1完成完整短交接。",
    next: "07 独立完成与 AI 评分",
    notes: ["两种流程都说明：16拍短交接与32拍长混合均展示完整顺序。", "06只引导A《まどろみ》＋B2《All Night》的32拍长混合。", "A＋B1只学习判断与顺序，07再完整操作16拍短交接。", "失败只重做当前8拍；统一响度目标-16 LUFS-I，峰值不超过-1dBTP。", "公开版本使用真实歌曲前需确认使用权。"]
  },
  "07": {
    title: "独立完成与 AI 评分",
    question: "没有步骤提示，你能独立完成一段完整转场吗？",
    lead: "固定使用A《まどろみ》和B1《我只在乎你》。开始前说明评分标准；录制开始后不再高亮、不提示、不自动修正，全部操作由用户完成，提交后再由AI评判。",
    goal: "独立完成约56–60秒的A→B1短交接，并获得可核验的AI评分",
    goalNote: "AI只在提交后分析真实录音与操作记录，过程中不会替用户操作。",
    guardrails: [["全程独立", "开始后折叠步骤，不框控件、不显示下一动作、不暂停或回退错误。设备原生读数保留。"], ["AI不代替操作", "AI只读取录音、操作记录与真实测量，不能调整Cue、Sync、GAIN、LOW、唱盘或Crossfader。"], ["评分可核验", "客观项引用真实数据，听感项引用具体时间点；AI不可用时明确标记待评，不猜分。"]],
    flow: ["查看评分标准", "独立准备", "独立录制", "提交作品", "AI 评判", "复盘或重做"],
    prompt: "这一次，系统不会告诉你下一步做什么。",
    promptBody: "你要独立完成试听、Cue、Sync、唱盘微调、GAIN、LOW、接入、Crossfader和收尾。AI只在提交后评分。",
    promptAction: "查看评分标准",
    sound: [["固定挑战", "A：具島直子《まどろみ》；B1：邓丽君《我只在乎你》。"], ["建议轮廓", "A单独约24拍＋16拍短交接＋B1单独约24拍，总成果约56–60秒。"]],
    concepts: [["AI评测｜提交后分析", "评分结合用户的真实操作数据、音频测量和整段听感，不在过程中纠正操作。", "总分100：Cue与乐句20、速度与贴拍20、音量与低频20、交接控制25、整体结构与听感15。"]],
    steps: [
      ["查看任务与评分标准", "开始前知道AI会评什么。", "评分表", "显示固定曲目、建议时长、参考轮廓与五项权重。", "阅读并确认开始；参考试听停止后才开放录制。", "确认规则且其他音频已停止。", "只解释评分，不给逐拍操作答案。"],
      ["独立完成准备", "自己决定试听、Cue、速度、GAIN与LOW。", "自由操作", "不高亮控件；只保留BPM、拍号、电平、旋钮位置和唱盘反馈。", "独立完成全部准备，准备好后主动开始录制。", "只检查设备可录制，不提前判定操作。", "所有偏差静默记录，提交后统一反馈。"],
      ["独立完成A→B1转场", "从第一声到最后一声都由用户决定。", "完整录制", "只显示模型、同步拍号、录制时间与停止按钮，不显示阶段、目标值或正确提示。", "独立完成A建立、B1进入、贴拍、LOW交换、Crossfader与收尾。", "录音至少40秒并实际包含A、重叠段和B1三个声音阶段后可提交。", "操作失误保留在作品中，不中途纠正。"],
      ["提交真实记录", "评分只看刚才的实际表现。", "回听 + 提交", "显示波形，只提供回听、提交AI评判和放弃本次。", "回听或直接提交；提交后记录只读。", "录音与操作事件使用同一时钟且数据完整。", "缺数据就说明并保留录音，不补造。"],
      ["AI给出五项分数", "把数据与听感合并成可解释成绩。", "AI评判", "显示总分、五个分项和证据时间线。", "展开分项，点击证据时间点回听4–8拍。", "五项等于总分；客观值来自本次记录；听感结论引用具体时间点。", "AI不可用时显示客观分，听感项标为待评，绝不猜分。"],
      ["独立重做或保存", "反馈指出问题，但下一次仍自己解决。", "保存 + 再挑战", "显示一个表现最好处和一个优先改进处，不自动修复。", "保存作品与评分，或重置全部控件从头挑战。", "保存后可回听证据；重做回到无提示准备。", "不到80分也允许保存；重做不显示上次正确位置。"]
    ],
    completion: "AI已完成这次独立转场评测。",
    completionBody: "成绩来自你的真实录音与全部操作记录。查看具体时间点，决定保存本次成果，或从头独立挑战一次。",
    next: "回到课程目录",
    notes: ["固定使用A《まどろみ》＋B1《我只在乎你》；用户自行决定具体操作。", "开始后不高亮、不纠错、不自动推进，只保留设备原生反馈。", "评分权重：20＋20＋20＋25＋15，80分为完成。", "录音、操作事件、音频分析和评分引用同一时间轴。", "AI不可用时保留录音与客观数据，听感项标记待评。"]
  }
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
}

const id = document.body.dataset.course;
const data = scripts[id];
if (!data) throw new Error("Unknown course script: " + id);

document.title = `${id} ${data.title}｜交互脚本`;
const nav = courses.map(([no, title]) => `<li><a href="course-${no}-interaction-script.html" ${no === id ? 'aria-current="page"' : ''}><span class="course-nav__no">${no}</span><span>${title}</span></a></li>`).join("");
const guardrails = data.guardrails.map(([title, body]) => `<article class="guardrail"><b>${esc(title)}</b><span>${esc(body)}</span></article>`).join("");
const flow = data.flow.map((item, index) => `<li><b>0${index + 1}</b><span>${esc(item)}</span></li>`).join("");
const sound = data.sound.map(([title, body], index) => `<article class="${index === 1 ? 'good' : ''}"><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`).join("");
const concepts = (data.concepts || []).map(([title, body, control]) => {
  const review = title.includes("没有新概念");
  return `<article class="concept-card ${review ? 'concept-card--review' : ''}"><span class="concept-card__badge">${review ? '综合运用' : 'NEW 新概念'}</span><h3>${esc(title)}</h3><p>${esc(body)}<span class="concept-card__control">${esc(control)}</span></p></article>`;
}).join("");
const steps = data.steps.map((step, index) => {
  const [title, purpose, mode, highlight, action, pass, feedback] = step;
  return `<article class="step" id="step-${index + 1}"><header class="step__title"><span class="step__no">${String(index + 1).padStart(2, "0")}</span><div><h2>${esc(title)}</h2><p class="step__purpose">${esc(purpose)}</p></div><span class="step__mode">${esc(mode)}</span></header><div class="step__grid"><div class="step__cell"><b>界面重点</b><p>${esc(highlight)}</p></div><div class="step__cell"><b>用户操作</b><p>${esc(action)}</p></div><div class="step__cell step__cell--pass"><b>通过条件</b><p>${esc(pass)}</p></div><div class="step__cell step__cell--feedback"><b>失败与反馈</b><p>${esc(feedback)}</p></div></div></article>`;
}).join("");
const notes = data.notes.map(note => `<li>${esc(note)}</li>`).join("");
const modelControlNote = Number(id) >= 4
  ? `<li><strong>仿真模型操作约束：</strong>PLAY / CUE 使用按压；唱盘沿盘面拨动或推拉；GAIN / EQ 沿旋钮圆周转动；通道推子纵向拖动；Crossfader 横向拖动。除按钮外，禁止以单击完成连续控制。</li>`
  : "";
const previous = String(Number(id) - 1).padStart(2, "0");
const nextHref = id === "07" ? "direction-board.html" : `course-${String(Number(id) + 1).padStart(2, "0")}-interaction-script.html`;

document.body.innerHTML = `
  <header class="topbar"><a class="brand" href="direction-board.html">FIRST MIX</a><span class="topbar__meta">课程交互脚本 · ${id} / 07</span></header>
  <div class="workspace">
    <aside class="course-nav" aria-label="课程脚本导航"><h2>课程</h2><ol>${nav}</ol></aside>
    <main class="content">
      <section class="hero"><div class="hero__main"><p class="eyebrow">COURSE ${id} · INTERACTION SCRIPT</p><h1>${esc(data.title)}</h1><p class="hero__lead">${esc(data.lead)}</p></div><aside class="hero__goal"><small>本课完成标准</small><strong>${esc(data.goal)}</strong><p>${esc(data.goalNote)}</p></aside></section>
      <section class="guardrails" aria-label="设计约束">${guardrails}</section>
      <section class="section"><header class="section__head"><h2>学习流程</h2><p>完成后进入下一步，失败只回到当前操作</p></header><ol class="flow" style="--flow-count:${data.flow.length}">${flow}</ol></section>
      <section class="section"><header class="section__head"><h2>开场问题弹窗</h2><p>点击后收成白底上方的紫色对话气泡</p></header><div class="question-preview"><div class="question-card"><img src="../assets/characters/dj-question-thinking-v1.png" alt="紫色头发的 DJ 角色正在思考"><h3>${esc(data.prompt)}</h3><p>${esc(data.promptBody)}</p><button type="button">${esc(data.promptAction)}</button></div></div></section>
      <section class="section"><header class="section__head"><h2>${id === "07" ? "本课知识状态" : "新概念先认识"}</h2><p>${id === "07" ? "不增加学习负担，只进行综合练习" : "首次出现时先解释，再让用户操作模型"}</p></header><div class="concept-grid">${concepts}</div></section>
      <section class="section"><header class="section__head"><h2>声音示范</h2><p>先让用户听出差异，再进入操作</p></header><div class="sound-brief">${sound}</div></section>
      <section class="steps" aria-label="逐步交互脚本">${steps}</section>
      <section class="completion"><h2>${esc(data.completion)}</h2><p>${esc(data.completionBody)}</p><div class="completion__actions"><a href="${nextHref}">${esc(data.next)} →</a><a class="secondary" href="#step-2">再做一次</a></div></section>
      <section class="production-note"><h2>制作备注</h2><ul>${notes}${modelControlNote}<li>所有声音遵守课程统一响度规范；按钮状态、错误反馈与键盘焦点均需可见。</li></ul></section>
      <p style="margin:24px 4px;color:#716a75;font-size:13px"><a href="course-${previous}-interaction-script.html">← 返回 ${previous} 脚本</a></p>
    </main>
  </div>`;
