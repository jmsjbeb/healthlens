/* ============================================================
   康鉴 HealthLens · 数据层
   - domains  健康域定义（评分维度）
   - panels   报告分组（对应体检单上的小节）
   - rules    单项指标解读规则（临床意义 / 建议 / 科室 / 复查）
   - depts    科室导航
   - sample   样板报告（真实体检数据，已结构化）
   - plan     干预计划模板
   说明：本文件所有参考区间与解读口径来自国内三甲医院体检报告通用参考值，
        不构成诊断依据。数据等级标记：实测 / 推算 / 模型 / 通用。
   ============================================================ */
window.HL = window.HL || {};

/* ---------- 健康域 ---------- */
HL.domains = [
  { id: 'metabolic',  name: '代谢与体重', weight: 0.16, desc: '体重、腰围、血糖、尿酸、血脂' },
  { id: 'cardio',     name: '心血管',     weight: 0.20, desc: '血压、同型半胱氨酸、血脂、血管超声' },
  { id: 'liver',      name: '肝脏',       weight: 0.12, desc: '肝功酶学、胆红素、肝脏超声' },
  { id: 'endocrine',  name: '内分泌',     weight: 0.12, desc: '甲状腺形态与功能' },
  { id: 'respiratory',name: '呼吸',       weight: 0.10, desc: '肺通气功能' },
  { id: 'blood',      name: '血液',       weight: 0.10, desc: '血常规三系' },
  { id: 'renal',      name: '肾脏与泌尿', weight: 0.10, desc: '肾功、尿常规、前列腺' },
  { id: 'sensory',    name: '感官与筛查', weight: 0.10, desc: '视力、耳鼻喉、肿瘤标志物' }
];

/* ---------- 报告分组 ---------- */
HL.panels = [
  '个人基本情况', '体格测量', '眼科视力', '血脂四项', '血常规', '同型半胱氨酸',
  '肝功五项', '肾功四项', '尿液分析', '心电图', '肺功能', '碳13呼气试验',
  '颈动脉超声', '甲状腺超声', '肝胆胰脾彩超', '双肾前列腺彩超',
  '肿瘤标志物', '耳鼻喉'
];

/* ---------- 科室导航 ----------
   stars : 7 星制，和关注项同一把尺子（7 = 最该先去）
   need  : must = 必须去（要抽血、要设备、要处方，自己做不到）
           skip = 这次可以先不去（生活方式能解决，或先复查再说）
   skip 的科室保留 prep / ask，用于「如果最终还是去了，怎么问」
------------------------------------------------------------ */
HL.depts = {
  cardio: {
    name: '心血管内科', icon: 'heart', stars: 7, need: 'must',
    within: '1 个月内',
    why: '{?hcy}同型半胱氨酸 {hcy.v} {hcy.u}，超出参考上限 {hcy.over}%，是独立于血脂之外的心血管风险因子。这一科要解决两件事：查清 Hcy 升高的原因（叶酸/B12 缺乏，还是 MTHFR 基因变异），以及决定要不要补、补多少。两件事都需要抽血和处方，自己做不到{/hcy}{^hcy}{?sbp}血压 {sbp.v}/{dbp.v} 已超出正常区间。这一科要做的是确认是否为持续性高血压（需要多次测量或动态血压监测）、评估靶器官损害（心电图、颈动脉超声、尿微量白蛋白），并决定要不要开始用药{/sbp}{^sbp}本次血脂异常（{?tg}甘油三酯 {tg.v} mmol/L{/tg}{?ldl}{?tg}、{/tg}低密度脂蛋白 {ldl.v} mmol/L{/ldl}）是动脉粥样硬化最直接的可干预因素。这一科要判断的是：按你的整体风险，目标值该定在哪、现在是否需要用药——抽血复查和处方都只能在这里做{/sbp}{/hcy}。',
    prep: ['记录近一周家庭血压（早晚各一次，静坐 5 分钟后测）', '空腹 8 小时以上，同日可一起查血脂、血糖、叶酸与维生素 B12', '说明家族中高血压的发病年龄，是否有早发心脑血管事件'],
    ask: ['{?hcy}我的 Hcy 升高更可能是叶酸/B12 缺乏还是 MTHFR 基因变异？需要做基因检测吗？{/hcy}{^hcy}{?sbp}我的血压需要药物干预，还是先做 3 个月生活方式调整？{/sbp}{^sbp}我的血脂需要用药吗？还是先做 3 个月饮食运动干预再复查？{/sbp}{/hcy}', '{?hcy}是否建议补充叶酸？剂量多少、补多久复查？{/hcy}{^hcy}{?sbp}需要做动态血压监测或家庭血压记录吗？{/sbp}{^sbp}我的 LDL 目标值该定在多少？需要查脂蛋白(a) 吗？{/sbp}{/hcy}', '{?sbp}以我目前的血压 {sbp.v}/{dbp.v} 和家族史，需要提前做动脉硬化评估吗？{/sbp}{^sbp}以我目前的血脂水平，需要提前做动脉硬化评估（颈动脉超声、脉搏波传导速度）吗？{/sbp}']
  },
  endo: {
    name: '内分泌科', icon: 'thyroid', stars: 6, need: 'must',
    within: '1 个月内',
    why: '{?thyroid}甲状腺结节需要功能学评估——超声只能看形态，看不到激素水平。{^tsh}而且本次体检做了甲状腺超声却没查甲功，这是报告里最大的信息缺口{/tsh}{?tsh}甲功已有结果，这一科的重点是结合结节形态定随访间隔{/tsh}{/thyroid}{^thyroid}本次异常属于代谢类问题（{?uric}尿酸 {uric.v} μmol/L{/uric}{?fbg}空腹血糖 {fbg.v} mmol/L{/fbg}），归内分泌科。这一科要判断的是代谢紊乱到了哪一步、是否需要药物介入，以及要不要顺带查糖化血红蛋白、胰岛素抵抗和肾功能——都要空腹抽血和处方，自己做不到{/thyroid}。',
    prep: ['{?thyroid}空腹 8 小时以上（甲功需空腹抽血）{/thyroid}{^thyroid}空腹 8 小时以上（血糖、尿酸、血脂都要空腹抽血）{/thyroid}', '{?thyroid}带上本次体检的甲状腺超声报告原件{/thyroid}{^thyroid}带上本次体检的生化报告，记下抽血日期{/thyroid}', '{?thyroid}如正在服用含碘药物、胺碘酮、甲状腺素，提前告知医生{/thyroid}{^thyroid}如正在服用利尿剂、止痛药或中成药，提前告知医生{/thyroid}'],
    ask: ['{?thyroid}我这个结节按 TI-RADS 3 类，复查间隔定多久？{/thyroid}{^thyroid}这个水平需要先用药，还是先做 3 个月生活方式干预再复查？{/thyroid}', '{?thyroid}回声欠均匀是否提示慢性淋巴细胞性甲状腺炎（桥本）？需要查 TPOAb / TgAb 吗？{/thyroid}{^thyroid}需要同时查糖化血红蛋白（HbA1c）、空腹胰岛素和肾功能吗？{/thyroid}', '{?thyroid}我的 TSH 如果正常，还需要干预吗？{/thyroid}{^thyroid}指标要控制到多少才算达标？多久复查一次？{/thyroid}']
  },
  resp: {
    name: '呼吸内科', icon: 'lung', stars: 5, need: 'must',
    within: '1 个月内',
    why: 'FEV1/FVC {fev1fvc.v}% 卡在慢阻肺诊断线（70%）上，但 FVC 达预计值 {fvc.v}%，这通常意味着呼气时间不足或用力方式不规范，会人为压低比值——这个"轻度阻塞"有可能是假阳性。复核需要肺功能仪和支气管舒张试验，只能去医院。',
    prep: ['检查前 24 小时停用支气管扩张剂（需遵医嘱）', '当天不吸烟、不喝咖啡、不做剧烈运动', '穿宽松衣物，检查时按技师口令全力呼气，吹够 6 秒'],
    ask: ['这次结果是否需要做支气管舒张试验确认可逆性？', 'FEV1/FVC {fev1fvc.v}% 是真实的轻度阻塞，还是用力不足导致的假阳性？', '{?_noSmoke}我没有吸烟史{/_noSmoke}{^_noSmoke}我有吸烟史{/_noSmoke}，这个结果还需要做胸部 CT 吗？']
  },
  eye: {
    name: '眼科', icon: 'eye', stars: 3, need: 'must',
    within: '3 个月内',
    why: '矫正视力右 {visionR.v} / 左 {visionL.v}，低于"矫正后应达 0.8"的常规标准，但报告小结写的是"未见明显异常"——报告自己前后矛盾。验光需要设备和镜片试戴，二十分钟的事，但替代不了。',
    prep: ['检查前 1 天避免长时间近距离用眼', '如戴隐形眼镜，软镜停戴 3 天、硬镜停戴 2 周', '带上现有眼镜/隐形眼镜的度数'],
    ask: ['矫正视力达不到 0.8，是度数不准还是有其他原因？', '需要做眼压和眼底检查吗？', '我每天屏幕时间较长，有什么护眼方案？']
  },
  gi: {
    name: '消化内科 / 肝病科', icon: 'liver', stars: 2, need: 'skip',
    within: '这次不用挂号，6 个月随体检复查',
    why: '{?_fattyLiver}超声看到脂肪肝，肝功{_liverPanel}（ALT {alt.v}、AST {ast.v}、GGT {ggt.v}、总胆红素 {tbil.v}）。{?liverNormal}这是单纯性脂肪肝，肝细胞还没被脂肪毒性损伤，正处在第一级、可逆的窗口{/liverNormal}{^liverNormal}转氨酶已经升高，可能已进入脂肪性肝炎阶段，需要专科评估并排除其他肝病原因{/liverNormal}{/_fattyLiver}{^_fattyLiver}本次肝功已有项目超出参考区间，转氨酶升高说明肝细胞正在受损。这一科要做的是逐个排除原因——病毒性肝炎、酒精、药物、脂肪肝，并决定是否需要用药，这些检查自己做不到{/_fattyLiver}。',
    skipWhy: '{?liverNormal}单纯性脂肪肝 + 肝功正常，指南上的一线处理就是减重和生活方式干预，没有需要专科医生开的药。减重 5–8% 就能减少约 30% 的肝内脂肪——这件事在厨房和跑道上做，不在门诊做{/liverNormal}{^liverNormal}肝功已经异常，需要专科医生判断病因并决定是否用药，不能只靠生活方式{/liverNormal}。',
    whenToGo: '出现以下任一情况再去：减重 6 个月后复查超声脂肪肝仍无改善；ALT 升到 50 以上；出现右上腹持续隐痛、乏力伴尿色加深。',
    prep: ['空腹 8 小时（需查肝功与血脂）', '{?_fattyLiver}带上腹部超声报告{/_fattyLiver}{^_fattyLiver}如近期没做过腹部超声，这次一并做{/_fattyLiver}', '记录近三个月的饮酒量与含糖饮料摄入'],
    ask: ['{?_fattyLiver}我的脂肪肝属于轻度还是中度？需要做肝脏瞬时弹性成像（FibroScan）评估纤维化吗？{/_fattyLiver}{^_fattyLiver}转氨酶升高的原因需要查哪些（病毒性肝炎、酒精、药物）？需要做肝脏瞬时弹性成像（FibroScan）评估纤维化吗？{/_fattyLiver}', '{?liverNormal}肝功正常的情况下，是否需要用药？{/liverNormal}{^liverNormal}需要用药吗？还是先减重复查？{/liverNormal}', '减重多少比例后复查超声比较合适？']
  },
  hema: {
    name: '血液科', icon: 'blood', stars: 1, need: 'skip',
    within: '先 1–3 个月复查血常规，持续异常再挂号',
    why: '淋巴细胞比例 {lymphp.v}% 与绝对值 {lymph.v} 同时轻微升高，但白细胞总数 {wbc.v} 正常、中性粒细胞 {neutp.v}% 正常、血小板 {plt.v} 正常。这个图形最常见的原因是近期病毒感染后的恢复期，可持续数周后自行回落。',
    skipWhy: '白细胞总数正常、没有贫血、没有血小板异常——真正需要警惕的血液病几乎不会只表现为"淋巴细胞轻度升高"。先复查一次血常规，多数人自己就降下来了。现在挂号，医生大概率也是让你过两个月再来查一次。',
    whenToGo: '复查后仍持续升高，或出现乏力、盗汗、体重下降、淋巴结肿大、反复发热，再挂血液科。',
    prep: ['复查血常规无需空腹，建议固定同一时间段', '复查前 1 周避免熬夜与剧烈运动', '记录近期是否有感冒、发热、口腔溃疡'],
    ask: ['淋巴细胞持续升高需要做外周血涂片吗？', '需要查 EBV / CMV 抗体吗？', '什么情况下需要做流式细胞术？']
  },

  /* ---- 以下 5 个科室是 v6 补的 ----
     之前只有 6 个科，导致尿蛋白、前列腺、妇科、骨密度这些异常
     根本没地方可去（家族的 dept 只能填 null）。 */
  nephro: {
    name: '肾内科', icon: 'kidney', stars: 5, need: 'must',
    within: '2 周内',
    why: '{?cr}肌酐 {cr.v} {cr.u}、尿素 {urea.v}，{?upro}同时尿蛋白 {upro.v}{/upro}。肾脏是「沉默器官」——肌酐升高时，肾小球滤过率往往已经丢掉一半以上。这一科要查的是 eGFR 具体值、尿微量白蛋白/肌酐比值、肾脏超声，判断是急性还是慢性、有没有可逆因素（脱水、止痛药、中草药、感染）{/cr}{^cr}尿蛋白 {upro.v}、尿潜血 {ublood.v}。这两项同时阳性，必须区分是肾小球来源还是泌尿道来源——靠的是尿沉渣镜检和 24 小时尿蛋白定量，体检套餐里没有{/cr}。',
    prep: ['空腹 8 小时（需同时查肾功、电解质、血脂）', '留晨起第一次尿的中段尿，不要用随机尿', '把近期所有用药写下来，包括中成药、保健品、止痛药——非甾体止痛药和中草药是常见的肾损伤原因'],
    ask: ['我的 eGFR 具体是多少？按这个值属于慢性肾脏病第几期？', '需要做 24 小时尿蛋白定量或尿微量白蛋白/肌酐比值吗？', '有没有可逆因素（脱水、药物、感染）需要先排除？']
  },
  uro: {
    name: '泌尿外科', icon: 'bladder', stars: 3, need: 'skip',
    within: '这次不用挂号，6–12 个月复查超声',
    why: '体检超声看到肾囊肿 / 前列腺改变 / 泌尿系结石。超声只能看形态和大小，判断不了梗阻、也判断不了结石成分。',
    skipWhy: '单纯性肾囊肿、前列腺钙化、小于 6mm 的结石，指南上都是定期复查——不手术、不吃药。现在挂号，医生大概率也是让你一年后再查一次超声。真正该去的是「结石大于 6mm 或已经引起肾积水」这种情况。',
    whenToGo: '出现以下任一情况再去：结石大于 6mm 或超声提示肾积水；腰腹部绞痛发作；肉眼血尿；夜尿增多、排尿困难已经影响生活；PSA 明显升高（>4 ng/mL）。',
    prep: ['泌尿系超声需要憋尿，检查前 1 小时饮水 500ml 不排尿', '带上既往超声报告，按时间排好——看变化速度比单次大小重要', '记录夜尿次数、排尿是否费力'],
    ask: ['这个囊肿 / 结石需要处理，还是定期复查？', '结石能判断成分吗？需要做代谢评估吗？', 'PSA 需要复查吗？间隔多久？']
  },
  gyn: {
    name: '妇科', icon: 'female', stars: 5, need: 'must',
    within: '1 个月内（避开月经期）',
    why: '妇科超声提示异常，或 TCT / HPV 有阳性结果。这类发现的性质和月经周期强相关，超声单看形态无法定性，需要结合周期、必要时加做阴道镜或肿瘤标志物。',
    prep: ['避开月经期，月经干净后 3–7 天最合适', '检查前 3 天避免阴道用药与性生活', '带上本次超声报告，以及既往 TCT / HPV 的报告和日期'],
    ask: ['这个超声发现需要处理，还是按周期复查？', '需要同时做 TCT 和 HPV 吗？下次复查间隔多久？', '这个发现和我的月经周期有关吗？需要固定在周期某一天复查吗？']
  },
  surg: {
    name: '普外科 / 甲状腺外科', icon: 'scalpel', stars: 3, need: 'skip',
    within: '这次不用挂号，6–12 个月复查超声',
    why: '甲状腺结节、胆囊息肉、乳腺结节这类「看得见但要不要动刀」的问题归这里。超声能看形态，但穿刺指征和手术指征要靠专科医生结合大小、边界、血流、生长速度一起判断。',
    skipWhy: 'TI-RADS 3 类的结节恶性风险约 2%，指南推荐 6–12 个月复查超声，不穿刺也不手术；胆囊息肉小于 10mm 同样是定期复查。现在挂号，多数情况只是得到一句「半年后再来查」。',
    whenToGo: '出现以下任一情况再去：结节 TI-RADS 4 类以上，或短期内有明显增大；伴声音嘶哑、吞咽困难；胆囊息肉 ≥10mm 或短期内增大；右上腹绞痛发作。',
    prep: ['带上既往所有超声报告，按时间排好——判断生长速度比单次大小更重要', '如需复查腹部超声，空腹 8 小时', '记录结节 / 息肉第一次发现的时间'],
    ask: ['按 TI-RADS 分级，我这个需要穿刺吗？', '和上次比有没有变大？这个变化速度算快吗？', '什么情况下才需要手术？']
  },
  ortho: {
    name: '骨科 / 骨质疏松门诊', icon: 'bone', stars: 2, need: 'skip',
    within: '这次不用挂号，1–2 年后复查骨密度',
    why: '骨密度 T 值偏低，或影像提示颈椎 / 腰椎退行性改变。这一科要判断的是骨量减少到什么程度、需不需要抗骨质疏松药物，以及腰背痛是退变还是别的原因。',
    skipWhy: '骨量减少阶段（T 值 −1.0 到 −2.5），一线处理是钙 + 维生素 D + 负重运动，不需要药物。颈椎腰椎的轻度退变在 40 岁以上几乎人人都有，没症状就不处理。',
    whenToGo: '出现以下任一情况再去：T 值 ≤ −2.5（已达骨质疏松）；发生过脆性骨折；持续腰背痛影响睡眠；出现下肢麻木、无力、走路不稳。',
    prep: ['带上骨密度报告，注明测的是腰椎还是髋部', '记录日常钙摄入（每天几份奶制品）与日照时间', '如有腰背痛，说明位置、持续多久、什么动作加重'],
    ask: ['我的 T 值需要药物治疗，还是先补钙和维生素 D？', '需要复查骨密度吗？间隔多久？', '我现在的运动方式对骨头够不够？需要加负重训练吗？']
  }
};

/* ---------- 单项解读规则 ----------
   severity: 0 = 无需处理 / 1 = 观察 / 2 = 需干预 / 3 = 优先处理
   benign:   true 表示"报告标红但无临床意义"，不扣分，单独成组
------------------------------------------------------------ */
HL.rules = {
  /* ---- 心血管 ---- */
  hcy: {
    name: '同型半胱氨酸（Hcy）', domain: 'cardio', severity: 3,
    headline: '血管内皮的慢性刺激物，已超出上限 {hcy.over}%',
    detail: '同型半胱氨酸是蛋氨酸代谢的中间产物。它偏高时会直接损伤血管内皮、促进氧化应激与血栓倾向，是独立于血脂之外的心脑血管风险因素。国内共识把 >15 μmol/L 定义为高同型半胱氨酸血症。你这个数值 {hcy.v} {hcy.u}，超出参考上限 {hcy.over}%，常见原因是叶酸或维生素 B12 摄入不足、MTHFR 基因 C677T 位点变异，少数与肾功能、药物相关。好消息是：这一项对补充叶酸的反应通常很好，是最容易改善的指标之一。',
    actions: [
      '查一次血清叶酸 + 维生素 B12 水平，判断是缺乏型还是代谢型',
      '每日增加 300–400g 深绿色叶菜（菠菜、芥蓝、油麦菜、芦笋），急火快炒或焯水，避免久煮流失叶酸',
      '每周 3–4 次豆类（毛豆、鹰嘴豆、扁豆），每日一份动物肝脏或蛋类补 B12',
      '叶酸补充剂需由医生决定剂量（常用 0.4–0.8mg/日），不要自行长期大剂量服用',
      '减少咖啡与浓茶与餐同服，会干扰叶酸吸收'
    ],
    dept: 'cardio', recheck: '3 个月后复查 Hcy + 叶酸 + B12', grade: '实测'
  },
  hdl: {
    name: '高密度脂蛋白胆固醇（HDL-C）', domain: 'cardio', severity: 0, benign: true,
    headline: '偏高是好事，这不是异常',
    detail: 'HDL 是"好胆固醇"，负责把外周组织的胆固醇运回肝脏处理，数值高意味着逆向转运能力强，对血管是保护性的。报告上之所以标红，只是因为超出了参考区间的上限 {hdl.hi}，但临床上 HDL 没有"过高有害"的通行结论（极端罕见情况下 >2.5 mmol/L 才需留意）。你 {hdl.v}，属于理想水平。',
    actions: ['无需任何干预，继续保持规律运动', '下次体检看到这项标红，可以直接忽略'],
    recheck: '随常规体检', grade: '实测'
  },
  /* ---- 血液 ---- */
  lymph: {
    name: '淋巴细胞（LYMPH% / LYMPH#）', domain: 'blood', severity: 1,
    headline: '比例与绝对值同时升高，但总数正常，多为良性',
    detail: '淋巴细胞比例 {lymphp.v}%（上限 {lymphp.hi}）、绝对值 {lymph.v}（上限 {lymph.hi}），两项都轻微超出。但白细胞总数 {wbc.v} 完全正常，中性粒细胞 {neutp.v}% 也在范围内——这种"总数正常、淋巴细胞占比升高"的图形，最常见的原因是近期病毒感染后的恢复期（感冒、咽炎、新冠等），可持续数周。其次是慢性炎症、应激、睡眠不足。真正需要警惕的血液系统疾病，通常伴随白细胞总数显著升高或降低、贫血、血小板异常，{?_bloodBg}你这些都没有{/_bloodBg}{^_bloodBg}你的血象背景已有其他变化，需要医生结合整体判断{/_bloodBg}。',
    actions: [
      '1–3 个月后复查一次血常规，看是否回落',
      '复查前保证 7 小时以上睡眠，避免剧烈运动与饮酒',
      '如复查仍持续升高或出现乏力、盗汗、体重下降、淋巴结肿大，再挂血液科',
      '不要因为这一项自行服用"提高免疫力"的保健品'
    ],
    dept: 'hema', recheck: '1–3 个月复查血常规', grade: '实测'
  },
  rdw: {
    name: '红细胞体积分布宽度（RDW-CV / RDW-SD）', domain: 'blood', severity: 0, benign: true,
    headline: '偏低说明红细胞大小很均匀，不是坏事',
    detail: 'RDW 衡量的是红细胞体积的离散程度。临床上关心的是它"升高"（提示缺铁、B12/叶酸缺乏导致的红细胞大小不均）。偏低只代表你的红细胞尺寸高度一致，没有任何病理意义。你的血红蛋白 {hgb.v} g/L、红细胞计数 {rbc.v}，都在正常范围，不存在贫血。',
    actions: ['无需干预', '这一项标红可以忽略'],
    recheck: '随常规体检', grade: '实测'
  },
  /* ---- 代谢 ---- */
  bmi: {
    name: '体重指数（BMI）', domain: 'metabolic', severity: 2,
    headline: '{?bmiOver}超重区间，{?waistOk}但腰围尚可——属于最好减的阶段{/waistOk}{^waistOk}腰围也已超标，属于腹型肥胖{/waistOk}{/bmiOver}{^bmiOver}已进入肥胖区间，是最该动手的时候{/bmiOver}',
    detail: 'BMI {bmi.v}，{?bmiOver}落在中国成人超重标准（24.0–27.9）内，距离肥胖线 28 还有 {_bmiGap}{/bmiOver}{^bmiOver}已经超过中国成人肥胖线 28{/bmiOver}。关键信息是你的腰围 {waist.v}cm，{?waistOk}低于{_sex}性 {_waistLimit}cm 的中心性肥胖标准，腰臀比 {_waistRatio} 也正常——说明脂肪更多分布在皮下而非内脏，这比"大肚子型"超重的代谢风险低不少{/waistOk}{^waistOk}已超过{_sex}性 {_waistLimit}cm 的中心性肥胖标准，属于腹型肥胖，内脏脂肪风险更高{/waistOk}。{?fattyliver}超声已经看到脂肪肝，说明肝脏脂肪沉积已经发生，减重 5–8% 就能明显改善{/fattyliver}。',
    actions: [
      '{?_needLose}目标：12 周减 {_dropKg}kg，BMI 降至 {_targetBMI} 左右{/_needLose}{^_needLose}目标：维持当前体重，重点放在增肌和腰围{/_needLose}',
      '每周称重固定在同一时间（晨起空腹排便后），看周均值而非单日波动',
      '每月量一次腰围（肚脐水平呼气末），目标 <{_waistGoal}cm',
      '不追求快速减重，每周 0.4–0.6kg 是可持续且不丢肌肉的速度'
    ],
    recheck: '每周自测体重，每月量腰围', grade: '实测'
  },
  uric: {
    name: '尿酸（UA）', domain: 'metabolic', severity: 0,
    headline: '{?uricHigh}尿酸 {uric.v}，已超过高尿酸血症判定线{/uricHigh}{^uricHigh}尿酸 {uric.v}，在正常范围内{/uricHigh}',
    detail: '{?uricHigh}已超过高尿酸血症的判定线（男性 420、女性 360），需要生活方式干预，是否用药由医生结合痛风史决定{/uricHigh}{^uricHigh}属于正常偏高。男性尿酸超过 420 即进入高尿酸血症区间{/uricHigh}。你目前没有痛风发作史，暂不需要用药，但减重期间要注意：快速减重、高果糖摄入、饮酒、脱水都会让尿酸短时上升。',
    actions: [
      '每日饮水 2000ml 以上，避免脱水',
      '严格限制含糖饮料与蜂蜜（果糖是尿酸升高的直接推手）',
      '减重速度控制在每周 0.5kg 以内，避免酮体竞争性抑制尿酸排泄',
      '海鲜与动物内脏适量，不必完全忌口'
    ],
    dept: 'endo', recheck: '随 6 个月复查', grade: '实测'
  },
  /* ---- 肝脏 ---- */
  fattyliver: {
    name: '脂肪肝（腹部超声）', domain: 'liver', severity: 2,
    headline: '{?liverNormal}肝功完全正常，说明还在可逆阶段{/liverNormal}{^liverNormal}脂肪肝已出现，肝功{_liverPanel}{/liverNormal}',
    detail: '超声描述"肝回声致密、管道走行欠清"，这是脂肪肝的典型影像表现。{?liverNormal}更关键的是你的肝功全部正常：ALT {alt.v}（上限 {alt.hi}）、AST {ast.v}、GGT {ggt.v}、总胆红素 {tbil.v}。这意味着目前是单纯性脂肪肝，没有肝细胞损伤——这是逆转的最佳窗口{/liverNormal}{^liverNormal}但本次肝功已经异常：ALT {alt.v}、AST {ast.v}、GGT {ggt.v}。转氨酶升高说明可能已从单纯脂肪沉积进入脂肪性肝炎阶段，需要医生介入，并排除病毒性肝炎、酒精性肝病、药物性肝损等其他原因{/liverNormal}。脂肪肝的进展路径是：单纯脂肪沉积 → 脂肪性肝炎 → 纤维化 → 肝硬化。',
    actions: [
      '减重 5% 可减少约 30% 肝内脂肪，减重 7–10% 可使炎症明显改善',
      '完全避免含糖饮料与果汁（果糖几乎全部由肝脏代谢，是脂肪肝的头号推手）',
      '主食一半换成全谷物/杂豆，精制米面与糕点尽量少',
      '每周 150 分钟以上中等强度有氧 + 2 次抗阻训练',
      '不饮酒（你目前无饮酒史，保持住）'
    ],
    dept: 'gi', recheck: '6–12 个月复查腹部超声 + 肝功 + 血脂', grade: '实测'
  },
  /* ---- 内分泌 ---- */
  thyroid: {
    name: '甲状腺结节', domain: 'endocrine', severity: 2,
    headline: '{?tsh}低风险结节按计划复查即可，不必急于处理{/tsh}{^tsh}结节风险不高，但本次没查甲功，这才是最该补的{/tsh}',
    detail: '报告对结节的形态描述（边界、回声、血流、有无淋巴结肿大）与 TI-RADS 分级，是判断良恶性的关键。3 类对应的恶性风险约 2%（一般 <5%），4 类以上才需要考虑穿刺活检；3 类及以下、且结节小于 1cm 时，国内指南建议 6–12 个月复查超声即可。\n\n真正值得注意的往往不是结节本身，而是"回声欠均匀"这类描述。回声不均最常见的原因是慢性淋巴细胞性甲状腺炎（桥本甲状腺炎），它会影响甲状腺功能，进而影响代谢率、体重、疲劳感和情绪——这和你正在处理的超重问题可能有关联。所以这次就诊的重点是查功能，不是查结节。',
    actions: [
      '加查甲状腺功能五项（TSH、FT3、FT4、TT3、TT4）+ 甲状腺自身抗体（TPOAb、TgAb）',
      '如 TPOAb 阳性，需低碘饮食：限制海带、紫菜、海苔，碘盐可正常使用但不必额外补碘',
      '不要自行服用含碘保健品或海藻类补充剂',
      '结节无需处理，但必须建立复查档案：6–12 个月一次超声，同一家医院同一台设备最好',
      '如出现颈部压迫感、声音嘶哑、吞咽不适，提前就诊'
    ],
    dept: 'endo', recheck: '6–12 个月复查甲状腺超声；甲功按医嘱', grade: '实测'
  },
  /* ---- 呼吸 ---- */
  lung: {
    name: '肺功能（FEV1/FVC {fev1fvc.v}%）', domain: 'respiratory', severity: 2,
    headline: '刚好卡在慢阻肺诊断线上，需要复核而不是直接下结论',
    detail: 'FEV1/FVC 是判断阻塞性通气障碍的核心指标，低于 70% 是慢阻肺的诊断门槛。你 {fev1fvc.v}%，{?lungBorder}处在临界{/lungBorder}{?lungBelow}已经低于门槛{/lungBelow}；FEV1 为预计值 {fev1.v}%，FVC 为 {fvc.v}%。这个组合有个技术细节：FVC 偏高往往意味着呼气时间不足或用力方式不规范，会人为压低 FEV1/FVC 比值。换句话说，这个"轻度阻塞"有可能是假阳性。\n\n但{?_noSmoke}你无吸烟史、{/_noSmoke}无粉尘接触史、无呼吸道症状，真性慢阻肺的可能性较低。规范做法是做一次带支气管舒张试验的复查肺功能，看比值是否可逆。',
    actions: [
      '1 个月内复查肺功能，务必包含支气管舒张试验',
      '检查时按技师口令"吸到底、吹到不能再吹"，呼气时间要够 6 秒',
      '复查前 24 小时停用任何支气管扩张剂（须经医生同意）',
      '日常注意：避免二手烟、厨房油烟，炒菜开足抽油烟机',
      '有氧运动时采用鼻吸口呼的节奏，不要憋气'
    ],
    dept: 'resp', recheck: '1 个月内复查肺功能', grade: '实测'
  },
  /* ---- 感官 ---- */
  vision: {
    name: '矫正视力（右 {visionR.v} / 左 {visionL.v}）', domain: 'sensory', severity: 1,
    headline: '报告写"未见明显异常"，但数值本身不达标',
    detail: '这是体检报告里常见的一处矛盾：小结写"未见明显异常"，可矫正视力右 {visionR.v}、左 {visionL.v} 其实低于"矫正后应达 0.8 以上"的常规标准。可能的原因是现有眼镜度数不准（近视加深或散光未矫正），也可能是体检现场视力表条件简陋、检查仓促。无论哪种，都值得重新验光确认——长期欠矫会让眼睛持续处于调节紧张状态，加重视疲劳。',
    actions: [
      '3 个月内到眼科做一次完整验光（含散光轴位）',
      '如度数有变化，及时更换镜片，不要"凑合戴"',
      '每天屏幕时间超过 6 小时，执行 20-20-20 法则：每 20 分钟看 20 英尺外 20 秒',
      '夜间避免关灯看手机'
    ],
    dept: 'eye', recheck: '3 个月内验光；之后每年一次', grade: '实测'
  },
  /* ---- 无需处理的良性发现 ---- */
  prostate: {
    name: '前列腺钙化斑', domain: 'renal', severity: 0,
    headline: '既往炎症的痕迹，无症状无需处理',
    detail: '超声探及"强回声斑"，是前列腺钙化灶的典型描述，多为既往前列腺炎愈合后留下的钙盐沉积。{?tpsa}{?tpsaOk}你没有排尿症状，TPSA {tpsa.v} ng/mL（远低于 4 的警戒线），完全不需要干预{/tpsaOk}{^tpsaOk}但 TPSA {tpsa.v} ng/mL 已偏高，需要泌尿外科进一步评估{/tpsaOk}{/tpsa}。',
    actions: ['无需处理，随体检观察即可', '如出现尿频、尿急、排尿不畅再就诊泌尿外科'],
    dept: 'uro', recheck: '随常规体检', grade: '实测'
  },
  /* ---- 正常但值得说明的项 ---- */
  tg: {
    name: '甘油三酯（TG）', domain: 'metabolic', severity: 0,
    headline: '{?tgOk}{tg.v}，处于理想水平{/tgOk}{^tgOk}{tg.v}，已高于参考上限{/tgOk}',
    detail: '{?tgOk}甘油三酯对饮食极为敏感，{tg.v} mmol/L 说明你目前的碳水与酒精摄入没有过量。这项正常是脂肪肝干预的有利起点——很多脂肪肝患者同时伴高甘油三酯，你没有{/tgOk}{^tgOk}甘油三酯 {tg.v} mmol/L，高于参考上限 {tg.hi}。这项对饮食极为敏感，通常先断含糖饮料、酒精和精制碳水 4–6 周，就能看到明显回落{/tgOk}。',
    actions: ['{?tgOk}保持当前饮食结构中的低糖部分{/tgOk}{^tgOk}断掉含糖饮料、果汁与酒精，主食减精制碳水{/tgOk}'],
    dept: 'cardio', recheck: '随 6 个月复查', grade: '实测'
  },
  ldl: {
    name: '低密度脂蛋白胆固醇（LDL-C）', domain: 'cardio', severity: 0,
    headline: '{?ldlOk}{ldl.v}，低于一般人群目标值 3.4{/ldlOk}{^ldlOk}{ldl.v}，已高于一般人群目标值{/ldlOk}',
    detail: 'LDL 是"坏胆固醇"，是动脉粥样硬化的主要推手。你 {ldl.v} mmol/L，{?ldlOk}属于理想水平{/ldlOk}{^ldlOk}已超出一般人群目标值 3.4。若同时有糖尿病或已发现斑块，目标还要更低{/ldlOk}。{?carotid}结合颈动脉超声"内-中膜不厚、未见斑块"，目前血管状态良好{/carotid}。',
    actions: ['{?ldlOk}继续保持低饱和脂肪饮食{/ldlOk}{^ldlOk}减少动物油脂、油炸与加工肉；增加燕麦、豆类与深海鱼{/ldlOk}'],
    dept: 'cardio', recheck: '随 6 个月复查', grade: '实测'
  },
  fbg: {
    name: '空腹血糖（FBG）', domain: 'metabolic', severity: 0,
    headline: '{?fbgOk}{fbg.v}，正常，但别掉以轻心{/fbgOk}{?fbgPre}{fbg.v}，已进入空腹血糖受损区间{/fbgPre}{?fbgDm}{fbg.v}，已达到糖尿病诊断线{/fbgDm}',
    detail: '{?fbgOk}空腹血糖 {fbg.v} mmol/L 在正常范围（3.9–6.1）。考虑到超重与脂肪肝，建议关注趋势：如果明年这项爬到 5.6 以上，就要警惕胰岛素抵抗。有条件可加查糖化血红蛋白（HbA1c）与空腹胰岛素，算 HOMA-IR 指数，比单看血糖更早发现代谢问题{/fbgOk}{?fbgPre}空腹血糖 {fbg.v} mmol/L，落在 6.1–7.0 的空腹血糖受损（糖尿病前期）区间。这个阶段靠生活方式干预，约有一半人可以回到正常。现在要做的是查糖化血红蛋白（HbA1c）确认近三个月平均水平，并开始减重{/fbgPre}{?fbgDm}空腹血糖 {fbg.v} mmol/L，已达到 7.0 的糖尿病诊断线。单次超标还不能确诊，需要在另一天复查确认，或做口服葡萄糖耐量试验（OGTT）。这一项应尽快到内分泌科就诊，不要拖到下次体检{/fbgDm}。',
    actions: ['{?fbgOk}下次体检加查糖化血红蛋白（HbA1c）{/fbgOk}{^fbgOk}尽快查糖化血红蛋白（HbA1c）与空腹胰岛素{/fbgOk}', '减少精制碳水与含糖饮料'],
    dept: 'endo', recheck: '随 6 个月复查', grade: '实测'
  },
  alt: {
    name: '丙氨酸氨基转移酶（ALT）', domain: 'liver', severity: 0,
    headline: '{?altOk}{alt.v}，正常——脂肪肝尚未造成肝损伤{/altOk}{^altOk}{alt.v}，已高于参考上限，需要医生介入{/altOk}',
    detail: 'ALT 是肝细胞损伤最敏感的指标。你 {alt.v} U/L（上限 {alt.hi}），{?altOk}完全正常。这印证了目前是单纯性脂肪肝阶段，肝细胞还没有被脂肪毒性损伤{/altOk}{^altOk}已经超出上限。这说明脂肪肝可能已从单纯脂肪沉积进入脂肪性肝炎阶段，需要查肝脏弹性成像，并到消化内科或肝病科评估{/altOk}。',
    actions: ['{?altOk}保持{/altOk}{^altOk}尽快就诊消化内科/肝病科{/altOk}', '如 ALT 持续高于参考上限，需进一步查肝脏弹性成像'],
    dept: 'gi', recheck: '随 6 个月复查', grade: '实测'
  },
  bp: {
    name: '血压（{sbp.v}/{dbp.v} mmHg）', domain: 'cardio', severity: 0,
    headline: '{?bpOk}理想血压，但家族史需要你提前防守{/bpOk}{^bpOk}血压已超标，需要尽快建立基线{/bpOk}',
    detail: '{sbp.v}/{dbp.v} {?bpOk}属于理想血压（<120/80）{/bpOk}{^bpOk}已超出理想血压区间（<120/80）{/bpOk}。{?hxHBP}你的家族史记录"高血压"——遗传背景是高血压最强的预测因素之一。{/hxHBP}{?hxDM}你的家族史记录"糖尿病"——糖尿病与高血压常并存，两者对血管的损害会叠加。{/hxDM}{?hcy}同型半胱氨酸升高叠加高血压，正是国内"H 型高血压"概念关注的组合（高血压 + Hcy 升高，脑卒中风险叠加）。{/hcy}{?bpOk}你目前血压很好，重点是守住它{/bpOk}{^bpOk}现在要做的是建立基线、限制钠盐，并尽快明确是否需要用药{/bpOk}。',
    actions: [
      '每月家庭自测血压 3–4 次，建立基线档案',
      '限盐：每日食盐 <5g，注意酱油、腌制品、外卖中的隐形盐',
      '{?hcy}把 Hcy 降下来，这是目前唯一可主动改变的环节{/hcy}{^hcy}下次体检加查同型半胱氨酸（Hcy），它与高血压叠加会放大脑卒中风险{/hcy}'
    ],
    dept: 'cardio', recheck: '每月自测；每年体检', grade: '实测'
  },
  tsh: {
    name: '甲状腺功能（未查）', domain: 'endocrine', severity: 1,
    headline: '本次体检缺项，是当前最大的信息缺口',
    detail: '本次报告做了甲状腺超声，但没有甲状腺功能（TSH/FT3/FT4）与自身抗体。超声只能看形态，看不到激素水平。在已经发现结节的背景下，甲功是判断是否存在桥本甲状腺炎及亚临床甲减的必要检查。这一项不是异常，是缺失。',
    actions: ['尽快补查：甲功五项 + TPOAb + TgAb', '空腹抽血，上午检查'],
    dept: 'endo', recheck: '1 个月内补查', grade: '缺失'
  }
};

/* 规则 → 解读家族
   用途：家族兜底时判断「这一族是不是已经有专属卡片了」。
   如果有，同族的其他异常项不再另开卡，而是并进那条卡的
   「同族其他项」里，避免 ALT / AST / GGT 各占一张卡。 */
(function () {
  var RULE_FAM = {
    hcy: 'hcy', hdl: 'lipid', tg: 'lipid', ldl: 'lipid', fbg: 'glucose',
    alt: 'liver', uric: 'renal', bmi: 'anthro', bp: 'vital', vision: 'eye',
    rdw: 'cbcR', lymph: 'cbcW', lung: 'lung', tsh: 'thyroid',
    prostate: 'tumor', fattyliver: 'imgLiver', thyroid: 'imgThyroid'
  };
  Object.keys(RULE_FAM).forEach(function (k) {
    if (HL.rules[k]) HL.rules[k].fam = RULE_FAM[k];
  });
})();

/* ---------- 优先级星级（7 星制） ----------
   7 = 最优先，1 = 可暂缓，0 = 假警报 / 正常项（不参与排序）

   排序不是拍脑袋。四项一起看：
     ① 数值偏离幅度 —— 超上限多少
     ② 器官层面是否已出现改变 —— 只有数值 vs 已经有影像/结构变化
     ③ 组合风险 —— 是否和其他异常指向同一条病理通路
     ④ 干预的紧迫性与有效性 —— 现在动手能不能改回来

   星越多不代表越严重。星多 = 现在最该动手。
------------------------------------------------------------ */
HL.starMeta = {
  /* ---- 数值驱动：星级随报告里的数字变，不是写死的常量 ---- */
  hcy: {
    s: function (c) {
      if (!c.hcy) return 0;
      if (c.hcy.v >= 15) return 7;
      if (c.hcy.v > 10) return 3;
      return 0;
    },
    why: '数值超上限 {hcy.over}%，是独立的心血管风险因子；同时叠上了脂肪肝、超重、高血压家族史，几项指向同一条通路。但它也是对干预反应最好的指标——补叶酸通常 8–12 周就能降下来。风险最大、收益也最大，所以排前面。'
  },
  fbg: {
    s: function (c) {
      if (!c.fbg) return 0;
      if (c.fbg.v >= 7.0) return 7;
      if (c.fbg.v >= 6.1) return 5;
      if (c.fbg.v >= 5.6) return 2;
      return 0;
    },
    why: '{?fbgDm}空腹血糖已达糖尿病诊断线，是必须尽快确认和处理的问题——它不像脂肪肝那样有十年窗口期{/fbgDm}{?fbgPre}空腹血糖落在糖尿病前期区间，现在干预约有一半机会回到正常，是性价比最高的时候{/fbgPre}{^fbgDm}{^fbgPre}空腹血糖正常，只需关注趋势{/fbgPre}{/fbgDm}。'
  },
  alt: {
    s: function (c) {
      if (!c.alt) return 0;
      if (c.alt.v >= 120) return 6;
      if (c.alt.v >= 80) return 5;
      if (c.alt.status !== 'normal') return 4;
      return 0;
    },
    why: '{?altOk}转氨酶正常，说明脂肪肝尚未造成肝细胞损伤，这一项是「好消息」而不是问题{/altOk}{^altOk}转氨酶已经升高，意味着肝细胞正在受损，需要尽快明确原因——这比单纯的脂肪沉积要严重一档{/altOk}。'
  },
  bp: {
    s: function (c) {
      if (!c.sbp || !c.dbp) return 0;
      if (c.sbp.v >= 160 || c.dbp.v >= 100) return 6;
      if (c.sbp.v >= 140 || c.dbp.v >= 90) return 5;
      if (c.sbp.v >= 130 || c.dbp.v >= 85) return 3;
      return 0;
    },
    why: '{?bpOk}血压在理想范围，守住即可{/bpOk}{^bpOk}血压已超出正常区间。高血压是最容易被忽视、也最容易造成长期损害的一项——它没有症状，但持续损伤血管{/bpOk}。'
  },
  ldl: {
    s: function (c) {
      if (!c.ldl) return 0;
      if (c.ldl.v >= 4.9) return 5;
      if (c.ldl.v >= 4.1) return 4;
      if (c.ldl.v > 3.4) return 3;
      return 0;
    },
    why: '{?ldlOk}LDL 在理想水平，继续保持{/ldlOk}{^ldlOk}LDL 是动脉粥样硬化的主要推手，超标越久、血管壁沉积越多。它不像转氨酶那样能很快降下来，需要持续干预{/ldlOk}。'
  },
  tg: {
    s: function (c) {
      if (!c.tg) return 0;
      if (c.tg.v >= 5.6) return 5;
      if (c.tg.v >= 2.3) return 4;
      if (c.tg.v > 1.82) return 2;
      return 0;
    },
    why: '{?tgOk}甘油三酯理想，说明当前饮食结构中的糖与酒没有过量{/tgOk}{^tgOk}甘油三酯对饮食极敏感，通常断糖断酒 4–6 周就能明显回落，是见效最快的一项{/tgOk}。'
  },
  uric: {
    s: function (c) {
      if (!c.uric) return 0;
      if (c.uric.v >= 540) return 5;
      if (c.uric.v >= 480) return 4;
      if (c.uricHigh) return 3;
      return 0;
    },
    why: '{?uricHigh}尿酸已超过高尿酸血症判定线。多数人无症状，但持续升高会沉积在关节和肾脏{/uricHigh}{^uricHigh}尿酸在正常范围，减重期间注意别让它升上来{/uricHigh}。'
  },
  thyroid: {
    s: function (c) {
      if (!c.thyroid) return 0;
      return c.tsh ? 4 : 6;
    },
    why: '结节本身恶性风险不高，真正的问题是"回声欠均匀"可能提示桥本，而桥本会影响代谢率、体重和疲劳感——这和你正在处理的超重可能是同一件事。加上甲功没查，信息缺口最大。'
  },
  fattyliver: {
    s: function (c) {
      if (!c.fattyliver) return 0;
      return c.liverNormal ? 6 : 7;
    },
    why: '{?liverNormal}已经有器官层面的影像改变，不只是数值超标。但肝功正常，说明还站在可逆的第一级，现在动手是成本最低的时候{/liverNormal}{^liverNormal}肝功已经异常，说明脂肪肝可能已进入脂肪性肝炎阶段，这比单纯脂肪沉积严重一档，需要医生介入{/liverNormal}。'
  },
  bmi: {
    s: function (c) {
      if (!c.bmi) return 0;
      return c.bmi.v >= 24 ? 5 : 0;
    },
    why: '{bmi.v} 本身不算重，但它是脂肪肝和代谢异常的土壤。减重 5–8% 能同时改善多项，是性价比最高的一个动作。'
  },
  lung: {
    s: 5,
    why: '卡在慢阻肺诊断线上，必须排除。但 FVC 偏高提示可能是测试误差，所以是"去复核"而不是"去治疗"——紧迫但不恐慌。'
  },
  tsh: {
    s: 4,
    why: '不是异常，是缺失。但它卡住了甲状腺那条线的判断，属于"补一个检查就能解锁一堆结论"的项。'
  },
  lymph: {
    s: function (c) {
      if (!c.lymph) return 0;
      return c._bloodBg ? 4 : 6;
    },
    why: '{?_bloodBg}轻度异常，白细胞总数和中性粒细胞都正常，最常见是病毒感染后恢复期。需要复查，不需要现在就跑医院{/_bloodBg}{^_bloodBg}淋巴细胞升高的同时，血象背景也有其他变化，需要医生结合整体判断{/_bloodBg}。'
  },
  vision: {
    s: 3,
    why: '报告自己前后矛盾（小结写"未见异常"，数值却不达标）。影响的是生活质量，不影响全身健康，排最后。'
  },
  hdl: {
    s: function (c) {
      if (!c.hdl) return 0;
      /* 偏高是好事，但极高值（>2.5）失去保护意义，反而要查一下 */
      if (c.hdl.v > 2.5) return 3;
      return 0;
    },
    why: '{?hdl}{?hdl.v}HDL {hdl.v} mmol/L。{/hdl.v}偏高通常是好事——它是"好胆固醇"，负责把外周胆固醇运回肝脏。常规区间上限只是统计学切点，不是危险线。但极高值（>2.5 mmol/L）不再带来额外保护，需要排查原因，所以这一档才给星级。{/hdl}'
  },
  rdw: { s: 0, why: '偏低说明红细胞大小很均匀，没有病理意义。' },
  prostate: { s: 0, why: '既往前列腺炎愈合后的钙化痕迹，无症状无需处理。' }
};

/* ---------- 样板报告（真实数据，已结构化） ----------
   ref: [下限, 上限]，null 表示单边或不适用
   status: 报告原文标注 normal / high / low / text
------------------------------------------------------------ */
HL.sample = {
  profile: {
    name: '样板报告',
    sex: '男',
    sexGrade: '推定（依据前列腺超声与 TPSA 检查项）',
    age: null,
    ageNote: '报告未含年龄栏，能量需求按 30 岁估算',
    height: 178, weight: 84, bmi: 26.51, waist: 83, hip: 105,
    sbp: 117, dbp: 76, pulse: 73,
    familyHx: '高血压',
    smoke: '无', alcohol: '无', allergy: '无', pastHx: '无', symptoms: '无',
    source: '体检中心报告（图片上传）',
    uploadedAt: '2026-11-02'
  },
  items: [
    /* 体格测量 */
    { id: 'height', name: '身高', panel: '体格测量', value: 178, unit: 'cm', ref: null, status: 'normal' },
    { id: 'weight', name: '体重', panel: '体格测量', value: 84, unit: 'kg', ref: null, status: 'normal' },
    { id: 'bmi', name: '体重指数 BMI', panel: '体格测量', value: 26.51, unit: 'kg/m²', ref: [18.5, 23.9], status: 'high' },
    { id: 'waist', name: '腰围', panel: '体格测量', value: 83, unit: 'cm', ref: [0, 90], status: 'normal' },
    { id: 'hip', name: '臀围', panel: '体格测量', value: 105, unit: 'cm', ref: null, status: 'normal' },

    /* 个人基本情况 */
    { id: 'sbp', name: '收缩压', panel: '个人基本情况', value: 117, unit: 'mmHg', ref: [90, 139], status: 'normal' },
    { id: 'dbp', name: '舒张压', panel: '个人基本情况', value: 76, unit: 'mmHg', ref: [60, 89], status: 'normal' },
    { id: 'pulse', name: '脉搏', panel: '个人基本情况', value: 73, unit: '次/分', ref: [60, 100], status: 'normal' },

    /* 眼科 */
    { id: 'visionR', name: '矫正视力（右）', panel: '眼科视力', value: 0.5, unit: '', ref: [0.8, 2], status: 'low' },
    { id: 'visionL', name: '矫正视力（左）', panel: '眼科视力', value: 0.6, unit: '', ref: [0.8, 2], status: 'low' },

    /* 血脂 */
    { id: 'ldl', name: '低密度脂蛋白胆固醇 LDL-C', panel: '血脂四项', value: 2.29, unit: 'mmol/L', ref: [0, 3.4], status: 'normal' },
    { id: 'hdl', name: '高密度脂蛋白胆固醇 HDL-C', panel: '血脂四项', value: 1.54, unit: 'mmol/L', ref: [1.16, 1.42], status: 'high' },
    { id: 'tc', name: '总胆固醇 TC', panel: '血脂四项', value: 4.52, unit: 'mmol/L', ref: [3.1, 5.2], status: 'normal' },
    { id: 'tg', name: '甘油三酯 TG', panel: '血脂四项', value: 1.44, unit: 'mmol/L', ref: [0.4, 1.82], status: 'normal' },
    { id: 'vldl', name: '极低密度脂蛋白胆固醇', panel: '血脂四项', value: 0.69, unit: 'mmol/L', ref: null, status: 'normal' },

    /* 血常规 */
    { id: 'wbc', name: '白细胞计数 WBC', panel: '血常规', value: 7.36, unit: '10^9/L', ref: [3.5, 9.5], status: 'normal' },
    { id: 'rbc', name: '红细胞计数 RBC', panel: '血常规', value: 4.91, unit: '10^12/L', ref: [4.3, 5.8], status: 'normal' },
    { id: 'hgb', name: '血红蛋白 HGB', panel: '血常规', value: 154, unit: 'g/L', ref: [130, 175], status: 'normal' },
    { id: 'hct', name: '红细胞压积 HCT', panel: '血常规', value: 0.456, unit: 'L/L', ref: [0.40, 0.50], status: 'normal' },
    { id: 'mcv', name: '平均红细胞体积 MCV', panel: '血常规', value: 92.9, unit: 'fL', ref: [82, 100], status: 'normal' },
    { id: 'mch', name: '平均 HGB 含量 MCH', panel: '血常规', value: 31.4, unit: 'pg', ref: [27, 34], status: 'normal' },
    { id: 'mchc', name: '平均 HGB 浓度 MCHC', panel: '血常规', value: 338, unit: 'g/L', ref: [316, 354], status: 'normal' },
    { id: 'rdwcv', name: '红细胞体积分布宽度 CV', panel: '血常规', value: 11.9, unit: '%', ref: [12.2, 14.8], status: 'low' },
    { id: 'rdwsd', name: '红细胞体积分布宽度 SD', panel: '血常规', value: 40.2, unit: 'fL', ref: [41.2, 53.6], status: 'low' },
    { id: 'plt', name: '血小板计数 PLT', panel: '血常规', value: 301, unit: '10^9/L', ref: [125, 350], status: 'normal' },
    { id: 'pct', name: '血小板压积 PCT', panel: '血常规', value: 0.33, unit: '%', ref: [0.19, 0.39], status: 'normal' },
    { id: 'mpv', name: '平均血小板体积 MPV', panel: '血常规', value: 10.9, unit: 'fL', ref: [9.2, 12.0], status: 'normal' },
    { id: 'pdw', name: '血小板体积分布宽度', panel: '血常规', value: 13.2, unit: 'fL', ref: [9.6, 15.2], status: 'normal' },
    { id: 'plcr', name: '大血小板比率 P-LCR', panel: '血常规', value: 32.3, unit: '%', ref: [19.7, 42.4], status: 'normal' },
    { id: 'neutp', name: '中性粒细胞百分比 NEUT%', panel: '血常规', value: 42.3, unit: '%', ref: [40, 75], status: 'normal' },
    { id: 'neut', name: '中性粒细胞绝对值 NEUT#', panel: '血常规', value: 3.11, unit: '10^9/L', ref: [1.8, 6.3], status: 'normal' },
    { id: 'lymphp', name: '淋巴细胞百分比 LYMPH%', panel: '血常规', value: 51.6, unit: '%', ref: [20, 50], status: 'high' },
    { id: 'lymph', name: '淋巴细胞绝对值 LYMPH#', panel: '血常规', value: 3.8, unit: '10^9/L', ref: [1.1, 3.2], status: 'high' },
    { id: 'monop', name: '单核细胞百分比 MONO%', panel: '血常规', value: 4.6, unit: '%', ref: [3, 10], status: 'normal' },
    { id: 'mono', name: '单核细胞绝对值 MONO#', panel: '血常规', value: 0.34, unit: '10^9/L', ref: [0.10, 0.60], status: 'normal' },
    { id: 'eop', name: '嗜酸细胞百分比 EO%', panel: '血常规', value: 1.0, unit: '%', ref: [0.4, 8], status: 'normal' },
    { id: 'eo', name: '嗜酸细胞绝对值 EO#', panel: '血常规', value: 0.07, unit: '10^9/L', ref: [0.02, 0.52], status: 'normal' },
    { id: 'basop', name: '嗜碱细胞百分比 BASO%', panel: '血常规', value: 0.5, unit: '%', ref: [0, 1], status: 'normal' },
    { id: 'baso', name: '嗜碱细胞绝对值 BASO#', panel: '血常规', value: 0.04, unit: '10^9/L', ref: [0, 0.06], status: 'normal' },

    /* 同型半胱氨酸 */
    { id: 'hcy', name: '血同型半胱氨酸', panel: '同型半胱氨酸', value: 20.41, unit: 'μmol/L', ref: [0, 15], status: 'high' },

    /* 肝功 */
    { id: 'alt', name: '丙氨酸氨基转移酶 ALT', panel: '肝功五项', value: 33.7, unit: 'U/L', ref: [9, 50], status: 'normal' },
    { id: 'ast', name: '天门冬氨酸氨基转移酶 AST', panel: '肝功五项', value: 21.6, unit: 'U/L', ref: [15, 40], status: 'normal' },
    { id: 'astalt', name: 'AST:ALT', panel: '肝功五项', value: 0.64, unit: '', ref: null, status: 'normal' },
    { id: 'ggt', name: 'γ-谷氨酰基转移酶 GGT', panel: '肝功五项', value: 31.5, unit: 'U/L', ref: [10, 60], status: 'normal' },
    { id: 'tbil', name: '总胆红素', panel: '肝功五项', value: 17.3, unit: 'μmol/L', ref: [0, 23], status: 'normal' },
    { id: 'dbil', name: '直接胆红素', panel: '肝功五项', value: 5.1, unit: 'μmol/L', ref: [0, 6.84], status: 'normal' },
    { id: 'ibil', name: '间接胆红素', panel: '肝功五项', value: 12.2, unit: 'μmol/L', ref: null, status: 'normal' },

    /* 肾功 */
    { id: 'cr', name: '肌酐（酶法）', panel: '肾功四项', value: 87.7, unit: 'μmol/L', ref: [57, 97], status: 'normal' },
    { id: 'fbg', name: '血糖（空腹）', panel: '肾功四项', value: 5.29, unit: 'mmol/L', ref: [3.9, 6.1], status: 'normal' },
    { id: 'uric', name: '尿酸', panel: '肾功四项', value: 405.7, unit: 'μmol/L', ref: [208, 428], status: 'normal' },
    { id: 'urea', name: '尿素', panel: '肾功四项', value: 5.2, unit: 'mmol/L', ref: [3.1, 8.0], status: 'normal' },
    { id: 'egfr', name: '肾小球滤过率 eGFR', panel: '肾功四项', value: 93.98, unit: 'ml/min', ref: [90, 200], status: 'normal' },

    /* 尿常规 */
    { id: 'uph', name: '尿液 pH 值', panel: '尿液分析', value: 5.5, unit: '', ref: [4.5, 8.0], status: 'normal' },
    { id: 'usg', name: '尿比重', panel: '尿液分析', value: 1.030, unit: '', ref: [1.003, 1.030], status: 'normal' },

    /* 肺功能 */
    { id: 'fev1', name: 'FEV1（占预计值）', panel: '肺功能', value: 94, unit: '%', ref: [80, 120], status: 'normal' },
    { id: 'fev1fvc', name: 'FEV1/FVC', panel: '肺功能', value: 71, unit: '%', ref: [70, 100], status: 'normal' },
    { id: 'fvc', name: 'FVC（占预计值）', panel: '肺功能', value: 107, unit: '%', ref: [80, 120], status: 'normal' },

    /* 碳13 */
    { id: 'c13', name: 'C13 呼气试验', panel: '碳13呼气试验', value: 0.2, unit: '', ref: [-4, 3.9], status: 'normal' },

    /* 肿瘤标志物 */
    { id: 'tpsa', name: '总前列腺特异性抗原 TPSA', panel: '肿瘤标志物', value: 0.346, unit: 'ng/mL', ref: [0, 4], status: 'normal' },
    { id: 'ca199', name: '糖类抗原 19-9', panel: '肿瘤标志物', value: 16.76, unit: 'U/mL', ref: [0, 35], status: 'normal' },
    { id: 'afp', name: '甲胎蛋白 AFP', panel: '肿瘤标志物', value: 1.662, unit: 'ng/mL', ref: [0, 10], status: 'normal' },
    { id: 'cea', name: '癌胚抗原 CEA', panel: '肿瘤标志物', value: 2.479, unit: 'ng/mL', ref: [0, 5], status: 'normal' }
  ],
  /* 影像与形态学发现（无单一数值，单独成项） */
  imaging: [
    { id: 'lungfunc', name: '肺功能（报告判读）', panel: '肺功能', finding: 'FEV1 94%、FVC 107%、FEV1/FVC 71%，报告小结：阻塞性通气功能轻度障碍', status: 'abnormal', ruleId: 'lung' },
    { id: 'fattyliver', name: '肝脏（腹部超声）', panel: '肝胆胰脾彩超', finding: '脂肪肝；胆、胰、脾未见明显异常', status: 'abnormal', ruleId: 'fattyliver' },
    { id: 'thyroid', name: '甲状腺（超声）', panel: '甲状腺超声', finding: '左叶低回声结节 2.4×1.7mm；右叶两枚低回声结节，最大 2.8×1.7mm；TI-RADS 3 类；余腺体回声欠均匀', status: 'abnormal', ruleId: 'thyroid' },
    { id: 'carotid', name: '颈动脉（超声）', panel: '颈动脉超声', finding: '双侧颈总动脉内-中膜不厚、尚光滑，未见斑块及异常血流', status: 'normal' },
    { id: 'ecg', name: '心电图', panel: '心电图', finding: '窦性心律，正常心电图', status: 'normal' },
    { id: 'prostate', name: '前列腺（超声）', panel: '双肾前列腺彩超', finding: '形态大小未见明显异常，内可探及强回声斑（钙化灶，既往炎症痕迹，无需处理）', status: 'normal' },
    { id: 'kidney', name: '双肾（超声）', panel: '双肾前列腺彩超', finding: '形态、大小、实质回声未见明显异常，双肾盂无扩张', status: 'normal' },
    { id: 'ent', name: '耳鼻喉', panel: '耳鼻喉', finding: '鼻、耳、喉、咽均未见异常，无不适感', status: 'normal' }
  ],
  urine: [
    { name: '颜色', value: '浅黄色' }, { name: '透明度', value: '清亮' },
    { name: '胆红素', value: '阴性' }, { name: '潜血', value: '阴性' },
    { name: '葡萄糖', value: '阴性' }, { name: '酮体', value: '阴性' },
    { name: '白细胞', value: '阴性' }, { name: '亚硝酸盐', value: '阴性' },
    { name: '蛋白质', value: '阴性' }, { name: '尿胆原', value: '阴性' }
  ]
};

/* ---------- 第二份样板报告（构造数据，用于验证「换个人」） ----------
   刻意选了和第一份完全不同的异常谱：
     第一份：Hcy 高 + 脂肪肝但肝功正常 + 视力不达标 → 心内/呼吸/眼科为主
     第二份：血糖到糖尿病线 + 肝功已异常 + 血压高       → 内分泌/消化/心内为主
   用来检验同一套规则在不同报告上能不能给出不同、且正确的结论。
   数据为构造，不代表任何真实个人。
------------------------------------------------------------------ */
HL.sample2 = {
  profile: {
    name: '示例报告 B', sex: '女', age: 45, sexGrade: '报告自带',
    height: 160, weight: 75, bmi: 29.3, waist: 92, hip: 104,
    sbp: 145, dbp: 92, pulse: 82,
    familyHx: '糖尿病（母亲）',
    smoke: '无', alcohol: '偶尔', allergy: '无', pastHx: '无', symptoms: '无',
    source: '构造示例数据', uploadedAt: '2026-11-02'
  },
  items: [
    { id: 'height', name: '身高', panel: '体格测量', value: 160, unit: 'cm', ref: null, status: 'normal' },
    { id: 'weight', name: '体重', panel: '体格测量', value: 75, unit: 'kg', ref: null, status: 'normal' },
    { id: 'bmi', name: '体重指数 BMI', panel: '体格测量', value: 29.3, unit: 'kg/m²', ref: [18.5, 23.9], status: 'high' },
    { id: 'waist', name: '腰围', panel: '体格测量', value: 92, unit: 'cm', ref: [0, 85], status: 'high' },
    { id: 'hip', name: '臀围', panel: '体格测量', value: 104, unit: 'cm', ref: null, status: 'normal' },
    { id: 'sbp', name: '收缩压', panel: '个人基本情况', value: 145, unit: 'mmHg', ref: [90, 139], status: 'high' },
    { id: 'dbp', name: '舒张压', panel: '个人基本情况', value: 92, unit: 'mmHg', ref: [60, 89], status: 'high' },
    { id: 'pulse', name: '脉搏', panel: '个人基本情况', value: 82, unit: '次/分', ref: [60, 100], status: 'normal' },
    { id: 'visionR', name: '矫正视力（右）', panel: '眼科视力', value: 1.0, unit: '', ref: [0.8, 2], status: 'normal' },
    { id: 'visionL', name: '矫正视力（左）', panel: '眼科视力', value: 1.0, unit: '', ref: [0.8, 2], status: 'normal' },
    { id: 'ldl', name: '低密度脂蛋白胆固醇 LDL-C', panel: '血脂四项', value: 4.1, unit: 'mmol/L', ref: [0, 3.4], status: 'high' },
    { id: 'hdl', name: '高密度脂蛋白胆固醇 HDL-C', panel: '血脂四项', value: 1.2, unit: 'mmol/L', ref: [1.16, 1.42], status: 'normal' },
    { id: 'tc', name: '总胆固醇 TC', panel: '血脂四项', value: 5.6, unit: 'mmol/L', ref: [3.1, 5.2], status: 'high' },
    { id: 'tg', name: '甘油三酯 TG', panel: '血脂四项', value: 3.2, unit: 'mmol/L', ref: [0.4, 1.82], status: 'high' },
    { id: 'wbc', name: '白细胞计数 WBC', panel: '血常规', value: 6.2, unit: '10^9/L', ref: [3.5, 9.5], status: 'normal' },
    { id: 'hgb', name: '血红蛋白 HGB', panel: '血常规', value: 128, unit: 'g/L', ref: [115, 150], status: 'normal' },
    { id: 'rbc', name: '红细胞计数 RBC', panel: '血常规', value: 4.3, unit: '10^12/L', ref: [3.8, 5.1], status: 'normal' },
    { id: 'plt', name: '血小板计数 PLT', panel: '血常规', value: 245, unit: '10^9/L', ref: [125, 350], status: 'normal' },
    { id: 'neutp', name: '中性粒细胞百分比 NEUT%', panel: '血常规', value: 58, unit: '%', ref: [40, 75], status: 'normal' },
    { id: 'lymphp', name: '淋巴细胞百分比 LYMPH%', panel: '血常规', value: 32, unit: '%', ref: [20, 50], status: 'normal' },
    { id: 'lymph', name: '淋巴细胞绝对值 LYMPH#', panel: '血常规', value: 2.0, unit: '10^9/L', ref: [1.1, 3.2], status: 'normal' },
    { id: 'alt', name: '丙氨酸氨基转移酶 ALT', panel: '肝功五项', value: 68, unit: 'U/L', ref: [7, 40], status: 'high' },
    { id: 'ast', name: '天门冬氨酸氨基转移酶 AST', panel: '肝功五项', value: 45, unit: 'U/L', ref: [13, 35], status: 'high' },
    { id: 'ggt', name: 'γ-谷氨酰基转移酶 GGT', panel: '肝功五项', value: 88, unit: 'U/L', ref: [7, 45], status: 'high' },
    { id: 'tbil', name: '总胆红素', panel: '肝功五项', value: 14.2, unit: 'μmol/L', ref: [0, 23], status: 'normal' },
    { id: 'fbg', name: '血糖（空腹）', panel: '肾功四项', value: 7.2, unit: 'mmol/L', ref: [3.9, 6.1], status: 'high' },
    { id: 'uric', name: '尿酸', panel: '肾功四项', value: 480, unit: 'μmol/L', ref: [155, 357], status: 'high' },
    { id: 'cr', name: '肌酐（酶法）', panel: '肾功四项', value: 62, unit: 'μmol/L', ref: [41, 73], status: 'normal' },
    { id: 'egfr', name: '肾小球滤过率 eGFR', panel: '肾功四项', value: 96, unit: 'ml/min', ref: [90, 200], status: 'normal' }
  ],
  imaging: [
    { id: 'fattyliver', name: '肝脏（腹部超声）', panel: '肝胆胰脾彩超', finding: '脂肪肝（中度）；胆、胰、脾未见明显异常', status: 'abnormal', ruleId: 'fattyliver' },
    { id: 'thyroid', name: '甲状腺（超声）', panel: '甲状腺超声', finding: '右叶低回声结节 5×4mm，TI-RADS 2 类', status: 'abnormal', ruleId: 'thyroid' },
    { id: 'carotid', name: '颈动脉（超声）', panel: '颈动脉超声', finding: '双侧颈动脉内-中膜稍厚，未见斑块', status: 'normal' },
    { id: 'ecg', name: '心电图', panel: '心电图', finding: '窦性心律，左室高电压', status: 'abnormal' }
  ],
  urine: []
};

/* ---------- 干预计划模板 ----------
   饮食用「手掌量化法」，不写克数——做饭没人称重。
   四周一轮菜单（28 天不重样），之后循环。
   运动按 12 个月排，不是只给一周。
------------------------------------------------------------ */
HL.plan = {

  /* ---- 手掌量化法 ---- */
  portion: {
    intro: '报告上的克数你不用管。用你自己的手当量具——手的大小和你的身体是匹配的，这是营养科常用的估算法，误差在 20% 以内，比不称重强得多。',
    units: [
      { k: '1 掌心', v: '手掌心大小，厚度约等于小指', use: '蛋白质：鸡胸、鱼、牛肉、虾，约 100g 生重' },
      { k: '1 拳头', v: '你自己拳头的体积', use: '主食：熟米饭/面条约 100g；薯类 1 个拳头大' },
      { k: '2 捧', v: '双手并拢捧起，轻轻压实', use: '蔬菜：生叶菜 150–200g，炒熟约一大盘' },
      { k: '1 拇指', v: '大拇指第一指节的体积', use: '油脂：约 10g，全天不超过 2.5 个拇指' },
      { k: '1 小把', v: '单手抓一把', use: '坚果约 15g（10 粒杏仁），全天 1 把' },
      { k: '1 杯', v: '普通水杯 250ml', use: '奶、无糖豆浆、酸奶' }
    ],
    daily: [
      { t: '蛋白质', v: '4–5 掌心', n: '鸡蛋、鱼、鸡、牛、虾、豆腐都算' },
      { t: '蔬菜', v: '6 捧以上', n: '其中至少 3 捧是深绿叶菜（补叶酸）' },
      { t: '主食', v: '3 拳头', n: '其中 2 拳头换成粗粮或薯类' },
      { t: '水果', v: '1 拳头', n: '整吃，不榨汁' },
      { t: '坚果', v: '1 小把', n: '无盐，下午加餐用' },
      { t: '烹饪油', v: '2.5 拇指', n: '约 25g，一家三口一天的炒菜量' },
      { t: '水', v: '8 杯', n: '约 2000ml，含茶不含饮料' }
    ],
    swapTip: '同一类食材随便换：鱼 ↔ 鸡 ↔ 虾 ↔ 牛肉；糙米 ↔ 藜麦 ↔ 玉米 ↔ 荞麦面；菠菜 ↔ 芥蓝 ↔ 油麦菜 ↔ 西兰花。换法看下面的采购清单，同一类里挑你买得到的。'
  },

  /* ---- 四周轮换菜单（28 天不重样） ---- */
  dietSets: [
    {
      name: '第 1 周 · 家常基础',
      tag: '最容易上手的一套',
      days: [
        { d: '周一', b: '燕麦 1 小碗 + 无糖豆浆 1 杯 + 水煮蛋 2 个 + 菠菜 1 捧', l: '杂粮饭 1 拳头 + 清蒸鲈鱼 1 掌心 + 蒜蓉西兰花 2 捧', d2: '番茄豆腐汤 1 碗 + 鸡胸 1 掌心 + 凉拌木耳 1 捧' },
        { d: '周二', b: '全麦面包 2 片 + 牛油果半个 + 无糖酸奶 1 杯 + 蓝莓 1 小把', l: '荞麦面 1 碗 + 卤牛腱 1 掌心 + 焯青菜 2 捧', d2: '冬瓜虾仁 1 盘 + 杂粮饭 1 拳头 + 清炒油麦菜 2 捧' },
        { d: '周三', b: '杂粮粥 1 碗 + 茶叶蛋 1 个 + 凉拌豆干 1 小块 + 小番茄 1 捧', l: '糙米饭 1 拳头 + 去皮鸡腿 1 个 + 清炒芦笋 2 捧', d2: '菌菇豆腐煲 1 碗 + 蒸南瓜 1 拳头 + 白灼芥蓝 2 捧' },
        { d: '周四', b: '无糖希腊酸奶 1 杯 + 混合坚果 1 小把 + 猕猴桃 1 个', l: '藜麦饭 1 拳头 + 三文鱼 1 掌心 + 烤彩椒西葫芦 1 盘', d2: '白灼虾 1.5 掌心 + 炒时蔬 2 捧 + 紫薯 1 个' },
        { d: '周五', b: '全麦饼卷鸡蛋生菜 1 个 + 无糖豆浆 1 杯', l: '杂粮饭 1 拳头 + 青椒炒鸡胸 1 掌心 + 凉拌海带丝 1 捧', d2: '番茄牛腩 1 碗（少油）+ 焯芥蓝 2 捧' },
        { d: '周六', b: '燕麦 1 小碗 + 低脂奶 1 杯 + 水煮蛋 1 个 + 小番茄 1 捧', l: '荞麦面 1 碗 + 毛豆 1 捧 + 卤鸡腿 1 个 + 青菜 2 捧', d2: '清蒸鱼 1 掌心 + 杂粮饭 1 拳头 + 蒜蓉菠菜 2 捧' },
        { d: '周日', b: '杂粮馒头半个 + 无糖豆浆 1 杯 + 鸡蛋 1 个 + 小番茄 1 捧', l: '糙米饭 1 拳头 + 白灼鸡 1 掌心 + 炒杂蔬 2 捧', d2: '豆腐味噌汤 1 碗 + 香煎鳕鱼 1 掌心 + 西兰花 2 捧' }
      ]
    },
    {
      name: '第 2 周 · 换蛋白不换结构',
      tag: '把鱼换成牛、鸡换成虾',
      days: [
        { d: '周一', b: '小米粥 1 碗 + 水煮蛋 1 个 + 凉拌黄瓜 1 捧 + 无糖豆浆 1 杯', l: '二米饭 1 拳头 + 番茄炒蛋 2 个 + 蒜蓉空心菜 2 捧', d2: '香菇滑鸡 1 碗 + 杂粮饭半拳头 + 白灼秋葵 1 捧' },
        { d: '周二', b: '全麦吐司 1 片 + 煎蛋 1 个 + 生菜番茄 1 捧 + 低脂奶 1 杯', l: '玉米 1 根 + 卤牛肉 1 掌心 + 凉拌菠菜 2 捧', d2: '清蒸鲳鱼 1 掌心 + 杂粮饭 1 拳头 + 炒莴笋 2 捧' },
        { d: '周三', b: '燕麦 1 小碗 + 奇亚籽 1 小勺 + 无糖酸奶 1 杯 + 苹果半个', l: '杂粮饭 1 拳头 + 青椒牛肉丝 1 掌心 + 蒜蓉芥蓝 2 捧', d2: '冬瓜丸子汤 1 碗 + 蒸紫薯 1 个 + 凉拌豆芽 1 捧' },
        { d: '周四', b: '水煮蛋 2 个 + 无糖豆浆 1 杯 + 全麦馒头半个 + 小番茄 1 捧', l: '荞麦面 1 碗 + 鸡丝 1 掌心 + 焯生菜 2 捧', d2: '虾仁炒蛋 1 盘 + 杂粮饭半拳头 + 清炒西葫芦 2 捧' },
        { d: '周五', b: '杂粮粥 1 碗 + 卤蛋 1 个 + 拌豆腐丝 1 小碟', l: '糙米饭 1 拳头 + 香菇滑鸡 1 掌心 + 白灼西兰花 2 捧', d2: '番茄龙利鱼 1 碗 + 杂粮饭半拳头 + 炒油麦菜 2 捧' },
        { d: '周六', b: '无糖酸奶 1 杯 + 混合坚果 1 小把 + 香蕉半根 + 燕麦 2 勺', l: '二米饭 1 拳头 + 瘦肉回锅肉（少油）1 掌心 + 炒时蔬 2 捧', d2: '鲫鱼豆腐汤 1 碗 + 杂粮饭半拳头 + 白灼菜心 2 捧' },
        { d: '周日', b: '全麦饼 1 张 + 鸡蛋 1 个 + 生菜 1 捧 + 无糖豆浆 1 杯', l: '杂粮饭 1 拳头 + 白灼虾 1.5 掌心 + 凉拌木耳 1 捧', d2: '清炖鸡腿 1 个 + 蒸南瓜 1 拳头 + 炒菠菜 2 捧' }
      ]
    },
    {
      name: '第 3 周 · 加豆制品与海产',
      tag: '植物蛋白 + 深海鱼，补 B12',
      days: [
        { d: '周一', b: '无糖豆浆 1 杯 + 全麦面包 2 片 + 花生酱 1 小勺 + 水煮蛋 1 个', l: '杂粮饭 1 拳头 + 麻婆豆腐 1 碗（少油）+ 蒜蓉青菜 2 捧', d2: '清蒸带鱼 1 掌心 + 杂粮饭半拳头 + 白灼芦笋 2 捧' },
        { d: '周二', b: '燕麦 1 小碗 + 低脂奶 1 杯 + 蓝莓 1 小把 + 水煮蛋 1 个', l: '藜麦饭 1 拳头 + 香煎鸡胸 1 掌心 + 烤南瓜 1 拳头 + 沙拉菜 2 捧', d2: '海带豆腐汤 1 碗 + 白灼虾 1 掌心 + 炒芥蓝 2 捧' },
        { d: '周三', b: '杂粮馒头 1 个 + 无糖豆浆 1 杯 + 拌海带丝 1 捧', l: '糙米饭 1 拳头 + 番茄牛腩 1 碗 + 炒西芹 2 捧', d2: '清蒸鲈鱼 1 掌心 + 蒸山药 1 拳头 + 蒜蓉菠菜 2 捧' },
        { d: '周四', b: '无糖希腊酸奶 1 杯 + 燕麦 2 勺 + 猕猴桃 1 个', l: '荞麦面 1 碗 + 卤鸡腿 1 个 + 焯小白菜 2 捧', d2: '香菇豆腐煲 1 碗 + 杂粮饭半拳头 + 凉拌秋葵 1 捧' },
        { d: '周五', b: '水煮蛋 2 个 + 无糖豆浆 1 杯 + 全麦吐司 1 片 + 小番茄 1 捧', l: '二米饭 1 拳头 + 黑椒鸡胸 1 掌心 + 炒西兰花 2 捧', d2: '冬瓜排骨汤 1 碗（撇油）+ 杂粮饭半拳头 + 白灼菜心 2 捧' },
        { d: '周六', b: '小米粥 1 碗 + 咸鸭蛋半个 + 凉拌豆腐 1 小碟', l: '杂粮饭 1 拳头 + 清蒸黄鱼 1 掌心 + 蒜蓉丝瓜 2 捧', d2: '番茄鸡蛋面 1 碗（荞麦面）+ 白灼菠菜 2 捧' },
        { d: '周日', b: '全麦饼卷鸡蛋生菜 1 个 + 无糖豆浆 1 杯', l: '糙米饭 1 拳头 + 白灼鸡 1 掌心 + 炒杂蔬 2 捧', d2: '鲫鱼豆腐汤 1 碗 + 蒸红薯 1 个 + 凉拌木耳 1 捧' }
      ]
    },
    {
      name: '第 4 周 · 外食友好版',
      tag: '食堂、外卖、火锅、烧烤怎么点',
      days: [
        { d: '周一', b: '燕麦 1 小碗 + 无糖豆浆 1 杯 + 水煮蛋 2 个', l: '食堂：米饭半份 + 清蒸鱼 1 掌心 + 两份绿叶菜（过水去油）', d2: '家里：番茄豆腐汤 1 碗 + 鸡胸 1 掌心 + 焯青菜 2 捧' },
        { d: '周二', b: '全麦面包 2 片 + 无糖酸奶 1 杯 + 香蕉半根', l: '外卖轻食：鸡胸杂粮沙拉 1 份（油醋汁）+ 一份清汤', d2: '香菇滑鸡 1 碗 + 杂粮饭半拳头 + 炒时蔬 2 捧' },
        { d: '周三', b: '杂粮粥 1 碗 + 卤蛋 1 个 + 拌黄瓜 1 捧', l: '食堂：杂粮饭 1 拳头 + 炒牛肉 1 掌心 + 两份菜（过水）', d2: '清蒸鱼 1 掌心 + 蒸南瓜 1 拳头 + 白灼芥蓝 2 捧' },
        { d: '周四', b: '无糖酸奶 1 杯 + 混合坚果 1 小把 + 蓝莓 1 小把', l: '面馆：牛肉面（面减半、多要青菜、不喝汤）', d2: '豆腐煲 1 碗 + 杂粮饭半拳头 + 凉拌菠菜 1 捧' },
        { d: '周五', b: '水煮蛋 2 个 + 无糖豆浆 1 杯 + 全麦馒头半个', l: '火锅：清汤锅 + 瘦牛肉 + 虾滑 + 蔬菜拼盘，蘸醋蒜，不喝汤', d2: '清淡日：白灼虾 1.5 掌心 + 焯青菜 2 捧 + 紫薯 1 个' },
        { d: '周六', b: '小米粥 1 碗 + 水煮蛋 1 个 + 拌豆干 1 小碟', l: '烧烤：烤鸡胸/烤鱼 + 烤蔬菜，不点烤肠、不吃主食', d2: '冬瓜汤 1 碗 + 杂粮饭半拳头 + 炒时蔬 2 捧' },
        { d: '周日', b: '全麦饼 1 张 + 鸡蛋 1 个 + 生菜 1 捧 + 无糖豆浆 1 杯', l: '家常：糙米饭 1 拳头 + 清蒸鲈鱼 1 掌心 + 蒜蓉西兰花 2 捧', d2: '菌菇豆腐汤 1 碗 + 白灼鸡 1 掌心 + 凉拌木耳 1 捧' }
      ]
    }
  ],

  /* ---- 采购清单 ---- */
  shopping: [
    { cat: '蛋白质（每餐 1 掌心）', items: '鸡蛋、鸡胸、去皮鸡腿、牛腱、瘦牛肉、鲈鱼、鲳鱼、黄鱼、带鱼、三文鱼、鳕鱼、龙利鱼、虾仁、鲜虾、豆腐、豆干、无糖豆浆、无糖酸奶、低脂奶' },
    { cat: '主食（每餐 1 拳头）', items: '燕麦片、糙米、小米、藜麦、荞麦面、全麦面包、全麦馒头、玉米、紫薯、红薯、南瓜、山药' },
    { cat: '蔬菜（重点补叶酸）', items: '菠菜、芥蓝、油麦菜、空心菜、小白菜、菜心、芦笋、西兰花、西芹、莴笋、秋葵、西葫芦、冬瓜、丝瓜、木耳、菌菇、海带（若 TPOAb 阳性则停海带）' },
    { cat: '水果（每天 1 拳头）', items: '蓝莓、猕猴桃、苹果、小番茄、香蕉（半根/次）——整吃，不榨汁' },
    { cat: '其他', items: '初榨橄榄油、奇亚籽、无盐混合坚果、姜蒜、黑胡椒、醋、生抽' },
    { cat: '需要清出厨房', items: '含糖饮料、果汁、蜂蜜、蛋糕饼干、油炸食品、加工肉制品（香肠/培根/火腿）、白酒啤酒' }
  ],

  /* ---- 一天怎么吃（时间线） ---- */
  eatFlow: {
    intro: '顺序比份量更重要。同样三顿饭，吃的时点不同，血糖曲线和饿的程度完全不一样。',
    rows: [
      { t: '起床后', k: '温水 1 杯', d: '不喝淡盐水、不喝蜂蜜水。一夜之间身体是缺水的状态，先补上。' },
      { t: '07:00–08:30', k: '早餐', d: '1 掌心蛋白 + 1 拳头主食 + 1 捧蔬菜。蛋白放在早上，能压住全天的食欲——这是三顿里最不该省的一顿。' },
      { t: '10:00', k: '加餐（可选）', d: '真饿了才吃。1 小把坚果，或 1 杯无糖酸奶。不饿就别吃，加餐不是任务。' },
      { t: '12:00–13:00', k: '午餐', d: '1 掌心蛋白 + 1 拳头主食 + 2 捧蔬菜。先吃菜和肉，最后吃主食，餐后血糖会平很多。' },
      { t: '15:30', k: '水果', d: '1 拳头，放在下午。水果放在晚上吃，果糖更容易转成肝内脂肪。' },
      { t: '18:00–19:00', k: '晚餐', d: '1 掌心蛋白 + 半拳头主食 + 2 捧蔬菜。主食减半是减重期最有效的一刀，但不要减到零。' },
      { t: '21:00 之后', k: '只喝水或淡茶', d: '不是「晚上吃东西会胖」这种玄学，是夜里吃的东西很难被消耗掉，而且会打断睡眠。' }
    ],
    tip: '三餐的间隔控制在 4–5 小时。间隔太短没有饥饿感，太长会在下一顿吃超。'
  },

  /* ---- 五个最常见的误区 ---- */
  myths: [
    { t: '「不吃主食瘦得快」', d: '前两周掉的那几斤几乎全是水分和糖原，一吃主食立刻回来。而且长期低碳会让训练没力气、掉肌肉，基础代谢跟着降。正确做法是把精制米面换成粗粮，不是不吃。' },
    { t: '「只吃水煮菜最健康」', d: '水煮菜的问题是没蛋白、没油、吃不久。蛋白质不够，减重减掉的是肌肉；油太少，脂溶性维生素吸收不了，皮肤和头发先出问题。' },
    { t: '「果汁是健康的」', d: '这是对脂肪肝最有害的一条。一个橙子榨成汁要 3–4 个橙子，膳食纤维全丢了，剩下的果糖直接进肝脏合成脂肪。整吃水果，不榨汁，不买果汁。' },
    { t: '「饿了就忍着」', d: '忍到晚上一定暴食。饿到发慌的时候，人不会去煮鸡胸，只会去拿饼干。正确做法是备好加餐，在「有点饿」的时候就吃。' },
    { t: '「周末放开吃」', d: '周一到周五每天少吃 300 kcal，一共 1500；周末两顿火锅烧烤就能吃回 2000。这就是很多人「明明很克制却不掉秤」的全部原因。' }
  ],

  /* ---- 周日 90 分钟备餐 ---- */
  prep: {
    head: '决定「今天吃什么」需要意志力，而意志力每天只有那么多。把选择提前做完，后面就不用选。',
    steps: [
      { t: '① 煮一锅杂粮饭 · 20 分钟', d: '糙米 + 藜麦 + 小米，一次煮 5 拳头量，分成 5 份冷冻。吃的时候微波 2 分钟，口感几乎不差。' },
      { t: '② 卤一锅蛋白 · 30 分钟', d: '鸡胸 2 块、牛腱 1 块、鸡蛋 6 个，一锅卤水煮出来，冷藏能放 4 天。这是工作日最省事的一步。' },
      { t: '③ 洗切三天量的叶菜 · 15 分钟', d: '菠菜、芥蓝、油麦菜洗净沥干，装保鲜盒垫一张厨房纸。叶菜别一次洗一周，第三天就开始烂。' },
      { t: '④ 分装 7 小把坚果 · 5 分钟', d: '用 7 个小袋分好，每袋一小把。整袋放在桌上，一次就会吃掉半袋。' },
      { t: '⑤ 煮一锅汤底 · 20 分钟', d: '番茄牛腩汤或冬瓜排骨汤（撇油），分装冷冻。晚上回家只需要烫个青菜、热一碗汤，10 分钟一顿饭。' }
    ],
    tip: '如果连 90 分钟都没有，只做 ①②④ 三步。这三步能解决工作日 80% 的「不知道吃什么」。'
  },

  /* ---- 饿了怎么办（加餐清单） ---- */
  snack: {
    head: '加餐不是破戒。两餐之间饿到发慌，下一顿一定吃超。关键是选对东西。',
    rows: [
      { kcal: '0', items: '水、淡茶、黑咖啡（不加糖不加奶）、无糖气泡水', note: '很多时候是渴了不是饿了，先喝一杯水等 10 分钟。' },
      { kcal: '≈50', items: '黄瓜 1 根、小番茄 1 捧、白萝卜条', note: '嘴馋想吃东西的时候用这个，热量几乎可以忽略。' },
      { kcal: '≈100', items: '无糖酸奶 1 杯、水煮蛋 1 个、无糖豆浆 1 杯', note: '带蛋白的加餐最抗饿，优先选这一类。' },
      { kcal: '≈150', items: '无盐坚果 1 小把（10 粒杏仁）、毛豆 1 捧', note: '下午 4 点最想吃东西的时段，用这个顶到晚饭。' }
    ],
    avoid: '饼干、面包、蛋糕、奶茶、果汁、水果干、酸奶饮料。这些东西的共同点是「吃不饱但热量很高」，是最容易在不知不觉中吃掉 500 kcal 的一类。'
  },

  /* ---- 烹饪方式 ---- */
  cook: {
    head: '同样的食材，做法不同，热量能差一倍。',
    order: [
      { k: '优先', v: '蒸 · 煮 · 白灼 · 凉拌', d: '几乎不额外加油，营养保留最完整。叶菜优先白灼或急火快炒。' },
      { k: '可以', v: '快炒 · 烤 · 空气炸', d: '控制油量即可。烤肉类用锡纸垫底，避免烤焦产生有害物。' },
      { k: '少用', v: '煎 · 红烧 · 干锅', d: '油和糖都高。真想吃，把汤汁留下不拌饭。' },
      { k: '避免', v: '油炸 · 糖醋 · 挂糊 · 勾芡', d: '这几类的热量密度是清蒸的 2–3 倍，也是脂肪肝最直接的推手。' }
    ],
    oil: '全天 2.5 个拇指（约 25g）。用不粘锅 + 喷油壶，能把实际用油量降一半。一家三口一天 75g 是上限，外面一顿饭就可能超。',
    season: '用醋、蒜、姜、柠檬、黑胡椒、辣椒、香菜、花椒提味。少用糖、蚝油、豆瓣酱、沙拉酱、番茄酱——这几样是隐形糖和隐形油的主要来源。',
    leaf: '绿叶菜急火快炒或焯水 30 秒就出锅，久煮会让叶酸流失一半以上。你的 Hcy 偏高，叶酸摄入是关键，这一条比吃多少菜更重要。'
  },

  /* ---- 怎么判断吃够了 ---- */
  fullness: {
    head: '减重期最需要学会的不是「算热量」，是「停筷子的时机」。',
    scale: [
      { n: '1', t: '饿到发慌、手抖、注意力散', d: '太晚了。到这一步下一顿几乎一定吃超。', tone: 'bad' },
      { n: '2', t: '明显饿，肚子叫', d: '该吃了。这时候吃，最容易按计划吃。', tone: 'warn' },
      { n: '3', t: '不饿了，也不撑', d: '目标。吃到这个点就放下筷子。', tone: 'good' },
      { n: '4', t: '有点撑，想松裤腰', d: '多了。偶尔一次没事，经常这样就减不下来。', tone: 'warn' },
      { n: '5', t: '撑得难受、犯困', d: '过量。餐后困倦就是血糖冲高的信号。', tone: 'bad' }
    ],
    tip: '饱的信号传到大脑要 20 分钟。吃快了，等你感觉到饱的时候，已经多吃了三分之一。每口嚼 15 下，或者把筷子放下几次，就能解决大部分「不知不觉吃多」。'
  },

  /* ---- 12 个月运动方案 ---- */
  monthProgram: [
    { m: 1, title: '建立习惯', aerobic: 150, strength: 2, hiit: 0, intensity: '中低（心率 64–70%）', tpl: 'base',
      milestone: '4 周内完成 12 次训练；含糖饮料归零', note: '这个月的目标不是掉秤，是把训练固定进日程。哪怕每次只做 25 分钟，只要不停，就是成功。' },
    { m: 2, title: '稳定输出', aerobic: 180, strength: 2, hiit: 1, intensity: '中（68–76%）', tpl: 'base',
      milestone: '体重下降 2–3kg；能连续快走 40 分钟不喘', note: '开始感到"想练"了，这是习惯形成的信号。别急着加量，先把频次守住。' },
    { m: 3, title: '强化剂量', aerobic: 200, strength: 3, hiit: 1, intensity: '中高（70–80%）', tpl: 'build',
      milestone: '腰围 −2cm；深蹲重量比第 1 月 +20%', note: '有氧加到 200 分钟，抗阻加到 3 次。体重可能停滞——这是肌肉在长的正常现象，看腰围不看秤。' },
    { m: 4, title: '巩固 + 第一次复查', aerobic: 200, strength: 3, hiit: 2, intensity: '中高（70–82%）', tpl: 'build',
      milestone: '复查肝功 / 血脂 / Hcy；体重 −5kg 左右', note: '第 12 周去复查。这组数字是后面 8 个月的基线，一定留好。' },
    { m: 5, title: '增肌启动', aerobic: 180, strength: 3, hiit: 1, intensity: '中高（72–82%）', tpl: 'muscle',
      milestone: '蛋白质稳定 4–5 掌心/日；引体向上辅助重量 −10kg', note: '有氧降一点，给力量腾恢复。蛋白质必须跟上，否则减的是肌肉。' },
    { m: 6, title: '力量强化', aerobic: 180, strength: 4, hiit: 1, intensity: '中高（72–82%）', tpl: 'muscle',
      milestone: '三大项重量 +15%；体脂再降 2 个点', note: '这是身材变化最明显的阶段。镜子比体重秤更能反映进展。' },
    { m: 7, title: '换个项目防腻', aerobic: 200, strength: 3, hiit: 1, intensity: '中（66–78%）', tpl: 'maintain',
      milestone: '加入一项球类 / 游泳 / 骑行，每周 1 次', note: '坚持到第 7 个月，最大的敌人是无聊。加一个"好玩"的运动，比加量更管用。' },
    { m: 8, title: '夏季维持', aerobic: 220, strength: 3, hiit: 1, intensity: '中（66–78%）', tpl: 'maintain',
      milestone: '体重稳定在目标 ±1kg', note: '天热注意补水和电解质，避开正午。室内游泳是这个月最好的选择。' },
    { m: 9, title: '体能测试', aerobic: 200, strength: 3, hiit: 2, intensity: '中高（70–80%）', tpl: 'maintain',
      milestone: '测 5 公里配速 / 1 分钟俯卧撑次数，建立新基线', note: '用数字记录进步，比"感觉好点了"更能撑住下一个季度。' },
    { m: 10, title: '年度冲刺', aerobic: 220, strength: 3, hiit: 2, intensity: '中高（72–84%）', tpl: 'maintain',
      milestone: '体脂进入 18% 区间；腰围 <80cm', note: '身体已经适应，需要新的刺激。可以把 HIIT 换成爬坡或跳绳。' },
    { m: 11, title: '巩固不冒进', aerobic: 200, strength: 3, hiit: 1, intensity: '中（68–78%）', tpl: 'maintain',
      milestone: '连续 30 天打卡；无伤病', note: '临近年底最容易受伤——疲劳累积 + 想冲业绩。这个月主动降量。' },
    { m: 12, title: '年度复盘', aerobic: 200, strength: 3, hiit: 1, intensity: '中（68–78%）', tpl: 'maintain',
      milestone: '年度体检对比；Hcy 与肝功复查；对比 1 月照片', note: '把第 1 个月的照片和第 12 个月的照片放一起看。这是你坚持下去的真正理由。' }
  ],

  /* ---- 周模板（按阶段切换，心率用最大心率百分比存，前端换算） ---- */
  weekTemplates: {
    base: [
      { d: '周一', type: '有氧', detail: '快走 40 分钟，步频 110–120 步/分', hr: [0.64, 0.72], dur: '40 分钟' },
      { d: '周二', type: '抗阻', detail: '下肢 + 核心：深蹲 3×12、硬拉 3×10、臀桥 3×15、平板支撑 3×40 秒', hr: [0.68, 0.78], dur: '40 分钟' },
      { d: '周三', type: '有氧', detail: '骑行或游泳 40 分钟，全程能说话但不能唱歌', hr: [0.64, 0.72], dur: '40 分钟' },
      { d: '周四', type: '恢复', detail: '快走 20 分钟 + 全身拉伸 15 分钟', hr: [0.55, 0.62], dur: '35 分钟' },
      { d: '周五', type: '抗阻', detail: '上肢 + 背：俯卧撑 3×12、哑铃划船 3×12、肩推 3×10、引体辅助 3×8', hr: [0.68, 0.78], dur: '40 分钟' },
      { d: '周六', type: '长有氧', detail: '快走或爬坡 50 分钟（坡度 5–8%），或羽毛球 40 分钟', hr: [0.62, 0.70], dur: '50 分钟' },
      { d: '周日', type: '主动恢复', detail: '散步 30 分钟 + 泡沫轴放松，不安排高强度', hr: [0.50, 0.58], dur: '30 分钟' }
    ],
    build: [
      { d: '周一', type: '有氧', detail: '快走 40 分钟，中段插入 4 组「1 分钟快 + 2 分钟慢」', hr: [0.70, 0.80], dur: '40 分钟' },
      { d: '周二', type: '抗阻', detail: '下肢：深蹲 4×10、罗马尼亚硬拉 3×10、箭步蹲 3×12、平板支撑 3×50 秒', hr: [0.72, 0.82], dur: '45 分钟' },
      { d: '周三', type: '有氧', detail: '骑行或游泳 45 分钟，保持均匀节奏', hr: [0.66, 0.74], dur: '45 分钟' },
      { d: '周四', type: '恢复', detail: '快走 25 分钟 + 拉伸，不碰器械', hr: [0.55, 0.62], dur: '40 分钟' },
      { d: '周五', type: '抗阻', detail: '上肢 + 背：俯卧撑 4×15、引体辅助 3×8、哑铃划船 3×12、肩推 3×10', hr: [0.72, 0.82], dur: '45 分钟' },
      { d: '周六', type: '长有氧', detail: '爬坡或球类 60 分钟，中途不停表', hr: [0.64, 0.72], dur: '60 分钟' },
      { d: '周日', type: '主动恢复', detail: '散步 30 分钟 + 泡沫轴，为下周留体力', hr: [0.50, 0.58], dur: '30 分钟' }
    ],
    muscle: [
      { d: '周一', type: '抗阻·推', detail: '卧推 4×8、肩推 3×10、双杠臂屈伸 3×10、绳索下压 3×12', hr: [0.72, 0.82], dur: '45 分钟' },
      { d: '周二', type: '有氧', detail: '快走 30 分钟，力量日之间只做低冲击', hr: [0.62, 0.70], dur: '30 分钟' },
      { d: '周三', type: '抗阻·拉', detail: '硬拉 4×6、引体向上 4×6、坐姿划船 3×12、面拉 3×15', hr: [0.72, 0.82], dur: '45 分钟' },
      { d: '周四', type: '恢复', detail: '快走 20 分钟 + 拉伸，睡够 7 小时', hr: [0.55, 0.62], dur: '35 分钟' },
      { d: '周五', type: '抗阻·腿', detail: '深蹲 4×8、保加利亚分腿蹲 3×10、提踵 3×15、卷腹 3×20', hr: [0.72, 0.82], dur: '45 分钟' },
      { d: '周六', type: '有氧', detail: '骑行或游泳 40 分钟，低冲击保护关节', hr: [0.64, 0.72], dur: '40 分钟' },
      { d: '周日', type: '主动恢复', detail: '散步 30 分钟 + 泡沫轴，力量期恢复比训练更重要', hr: [0.50, 0.58], dur: '30 分钟' }
    ],
    maintain: [
      { d: '周一', type: '有氧', detail: '快走或慢跑 40 分钟', hr: [0.66, 0.74], dur: '40 分钟' },
      { d: '周二', type: '抗阻', detail: '全身循环：深蹲、卧推、划船各 3×10，连做 3 轮', hr: [0.70, 0.80], dur: '40 分钟' },
      { d: '周三', type: '兴趣运动', detail: '球类 / 游泳 / 骑行，选一个你真想去的', hr: [0.64, 0.78], dur: '50 分钟' },
      { d: '周四', type: '恢复', detail: '快走 20 分钟 + 拉伸', hr: [0.55, 0.62], dur: '35 分钟' },
      { d: '周五', type: '抗阻', detail: '全身循环：硬拉、肩推、引体各 3×8，连做 3 轮', hr: [0.70, 0.80], dur: '40 分钟' },
      { d: '周六', type: '长有氧', detail: '户外徒步或长距离骑行 60–90 分钟', hr: [0.60, 0.70], dur: '75 分钟' },
      { d: '周日', type: '主动恢复', detail: '散步 30 分钟 + 泡沫轴', hr: [0.50, 0.58], dur: '30 分钟' }
    ]
  },

  /* ---- 每次训练的标准流程 ---- */
  session: {
    head: '一次训练分四段。大多数人省掉前后两段，然后在前 3 个月里伤掉膝盖或腰。',
    steps: [
      { t: '0–5 分钟', k: '热身', d: '关节绕环（踝、膝、髋、肩各 10 圈）+ 原地踏步或开合跳 2 分钟，到微微出汗。冷肌肉直接上重量，是最常见的受伤原因。' },
      { t: '5–10 分钟', k: '激活', d: '臀桥 15 次、弹力带侧向走 15 步、肩胛后缩 15 次。这三下是让「该发力的肌肉」先醒过来，否则深蹲会用腰代偿。' },
      { t: '10–40 分钟', k: '主训练', d: '按当天计划做。抗阻日组间休息 60–90 秒，有氧日保持心率区间稳定。' },
      { t: '40–45 分钟', k: '放松', d: '静态拉伸，每个动作 30 秒，重点是大腿前后侧、髋、胸、背。不拉伸不会「变粗」，但会让第二天的酸痛更久。' }
    ],
    tip: '如果只有 20 分钟，砍掉主训练的组数，不要砍热身。5 分钟热身换来的是一整年不受伤。'
  },

  /* ---- 五个基础动作怎么做 ---- */
  moves: [
    { t: '深蹲', d: '脚与肩同宽，脚尖略外八 15°。重心在整个脚掌，不要只压脚跟。下蹲时先屈髋再屈膝，蹲到大腿与地面平行就起。膝盖方向跟着脚尖走，不能内扣。',
      err: '常见错误：膝盖内扣、脚跟离地、下蹲时弓腰。三个里中任何一个，都先把重量降到零，只做自重。' },
    { t: '髋铰链（硬拉的基础）', d: '这个动作不是「弯腰」，是「把屁股往后推」。膝盖微屈固定，背全程挺直，感觉大腿后侧被拉紧，推到不能再推就起身。',
      err: '常见错误：用腰去弯、下巴抬起、杠铃离身体太远。学会这个动作，腰就不容易伤。' },
    { t: '俯卧撑', d: '手比肩略宽，手指朝前。身体从头到脚跟一条直线，收紧腹部和臀。下到胸口离地约一拳，推起时肩胛骨打开。',
      err: '做不了标准版就降级：推墙 → 推桌子 → 跪姿 → 标准。降级不丢人，硬撑才会伤肩。' },
    { t: '划船', d: '用弹力带或哑铃。上身前倾约 45°，背挺直，肘贴着身体往后拉，拉到肩胛骨夹紧，停 1 秒再放回。',
      err: '常见错误：耸肩、用腰甩、只动手臂不夹背。这个动作练的是背，不是手臂。' },
    { t: '平板支撑', d: '肘在肩正下方，身体一条直线。收紧腹部和臀，正常呼吸，不要憋气。撑到姿势开始变形就停，不追求时间。',
      err: '常见错误：塌腰（伤腰）、撅臀（没练到）、憋气（血压升高）。姿势变形后的每一秒都没有意义。' }
  ],

  /* ---- 没器械怎么办 ---- */
  equip: {
    head: '不需要先办健身卡。下面三档按预算排，第一档就够用一整年。',
    tiers: [
      { k: '零器械', v: '自重 + 一条弹力带', d: '弹力带约 20–40 元。深蹲、俯卧撑、臀桥、平板、弹力带划船、侧向走，六个动作能覆盖全身。前 3 个月完全够。' },
      { k: '一对可调哑铃', v: '约 200–400 元', d: '能覆盖 90% 的抗阻动作。选可调重量（2.5–20kg），别买固定重量——三个月后就不够用了。' },
      { k: '健身房', v: '按月或按次', d: '优点是大重量和器械轨迹更安全。先学动作模式，别一上来就上大重量。有教练时优先问「我这个动作对不对」，不是「帮我排个计划」。' }
    ],
    tip: '在家练最大的障碍不是器械，是「换衣服出门」这一步。把弹力带放在客厅看得见的地方，比办卡有用得多。'
  },

  /* ---- 有氧怎么选 ---- */
  cardio: {
    head: '没有「最好的有氧」，只有「你能坚持的那个」。按关节负担从低到高排：',
    rows: [
      { k: '快走', d: '零门槛、膝友好、随时能做。起步阶段唯一推荐。速度到「能说话但不能唱歌」就够，不用跑。', tag: '最推荐' },
      { k: '骑行', d: '膝友好，能连续做很久，通勤可以嵌进去。注意座垫高度：踩到底时膝盖微屈 15°。', tag: '通勤首选' },
      { k: '游泳', d: '全身参与、关节零冲击，体重较大的人首选。缺点是场地和氯，另外泳后容易饿，注意别吃超。', tag: '关节最友好' },
      { k: '爬楼 / 爬坡', d: '单位时间消耗高，对臀腿刺激好。但对膝盖要求高，体重大的阶段先别做，等减了 5kg 再说。', tag: '效率高' },
      { k: '跳绳 / HIIT', d: '时间效率最高，20 分钟顶 40 分钟。但需要基础，每周不超过 2 次，否则容易跟腱和膝盖出问题。', tag: '进阶再用' }
    ],
    tip: '你的肺功能还在待复核，有氧优先选节奏稳定的（快走、骑行），不要选需要憋气发力的项目。等复查确认后再加高强度。'
  },

  /* ---- 安全红线 ---- */
  safety: {
    head: '下面这些情况出现，立刻停下，不要「再坚持一下」。',
    rows: [
      { t: '胸痛、胸闷、压榨感', d: '立刻停止，坐下，必要时就医。这一条没有例外。', tone: 'bad' },
      { t: '头晕、眼前发黑、出冷汗', d: '停下坐下，测血糖。减重期吃太少 + 空腹运动，很容易出现低血糖。', tone: 'bad' },
      { t: '关节刺痛（不是肌肉酸）', d: '停掉这个动作，换不疼的替代动作。肌肉酸痛可以继续，关节刺痛不能。', tone: 'warn' },
      { t: '停 5 分钟心率还降不下来', d: '说明这次强度超了。下次降一档，或者缩短时长。', tone: 'warn' },
      { t: '感冒发热、熬夜后', d: '不练。发热时运动会加重心脏负担，熬夜后练容易受伤。', tone: 'warn' },
      { t: '空腹血糖 >13.9 或尿酮阳性', d: '不运动，先处理血糖。这条对糖尿病或糖尿病前期的人尤其重要。', tone: 'bad' }
    ],
    tip: '运动中出现不适，判断标准很简单：能正常说完整一句话就继续，说不出来就降强度。'
  },

  /* ---- 记录什么 ---- */
  track: {
    head: '打卡只能证明「动了」，不能证明「进步了」。下面四组数字才是真的。',
    rows: [
      { t: '体重', f: '每周 1 次', d: '晨起、空腹、排便后、同一台秤。只看周均值，单日波动 1kg 是水分，没有意义。' },
      { t: '腰围', f: '每月 1 次', d: '肚脐水平，呼气末，别收腹。腰围比体重更能反映内脏脂肪的变化。' },
      { t: '训练重量', f: '每次记录', d: '同一个动作比上周多做 1 次，或多加 2.5kg，就是进步。这是「力量在长」的唯一证据。' },
      { t: '同角度照片', f: '每 4 周 1 次', d: '同一个位置、同一光线、同一个姿势。第 12 周把第 1 周的照片放一起看，比任何数字都有说服力。' }
    ],
    tip: '体重不动但腰围在降、或者重量在涨，说明脂肪在掉、肌肉在长——这是最好的情况，别因为秤上的数字焦虑。'
  },

  /* ---- 坚持机制 / 防掉队 ---- */
  stick: {
    head: '长期计划真正难的不是"怎么练"，是"断了之后怎么接回来"。下面四条是给断档准备的，不是给顺利的时候准备的。',
    rules: [
      { t: '断 1–2 天', d: '直接接上原计划，不用补练。漏掉的那次别加到第二天——双倍训练是受伤的头号原因。' },
      { t: '断 3–7 天', d: '从原剂量的 60% 重启一周（原计划 40 分钟快走，先做 25 分钟）。身体对训练刺激的保留期约两周，一周就能回到原来的量。' },
      { t: '断超过 7 天', d: '回到「第 1 个月」的模板重来一遍，别试图从断掉的地方接。这不是失败，是训练周期的正常重置。' },
      { t: '最低有效剂量', d: '实在没时间，做 10 分钟也算。10 分钟快走对血糖的改善，是 0 分钟的无限倍。' }
    ],
    review: '每 4 周复盘一次：晨起空腹称重、量腰围、回看打卡率。三项里只要有两项在变好，就继续，不用改任何东西。',
    reward: '在第 4、8、12 周末给自己设一个非食物奖励——一次按摩、一件新衣服、一场电影。用吃奖励自己，会抵消掉一半的努力。'
  }
};
