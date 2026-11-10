/* ============================================================
   康鉴 HealthLens · 指标字典 + 解读家族
   ------------------------------------------------------------
   为什么要单独一个文件：
   原来 62 项指标靠 engine.js 里一张 20 条的手写 MAP 映射到 17 条
   手写规则。每条规则都要单独写 headline / detail / actions，扩到
   200 项等于再写 180 条 —— 既写不完，也维护不动。

   现在的分法：
     ① 专属规则（HL.rules，17 条）—— 最该被讲透的核心项，
        有独立文案、独立星级算法、独立科室。
     ② 解读家族（HL.fam，19 个）—— 按「同一类指标讲同一件事」
        归组。同一家族的异常项自动聚合成一张卡，文案由家族模板
        加实际数值生成。
     ③ 字典（HL.dict，200 项）—— 只描述「这项是什么、正常范围、
        高了低了往哪走」。不含文案。

   于是「扩字典」变成纯数据录入，不再需要写解读。

   参考区间说明：这里存的是兜底值，用于报告没印参考区间的场景。
   真实报告自带区间时一律以报告为准（engine 里 it.ref 优先）。
   数值取自国内三甲体检中心通用区间，不构成诊断依据。
   ============================================================ */
window.HL = window.HL || {};

HL.dict = [];
HL.dictById = {};

/* 紧凑登记：D(id, 名称, 单位, [下限,上限], 方向, 家族, 附加) */
function D(id, name, unit, ref, dir, fam, o) {
  var x = { id: id, name: name, unit: unit, ref: ref, dir: dir || 'both', fam: fam };
  if (o) for (var k in o) if (o.hasOwnProperty(k)) x[k] = o[k];
  HL.dict.push(x);
  HL.dictById[id] = x;
}

/* ============================================================
   一、体格测量（8）
   ============================================================ */
D('height', '身高', 'cm', null, 'both', 'anthro');
D('weight', '体重', 'kg', null, 'both', 'anthro');
D('bmi', '体重指数 BMI', 'kg/m²', [18.5, 23.9], 'both', 'anthro', { rule: 'bmi' });
D('waist', '腰围', 'cm', [0, 90], 'high', 'anthro', { sexRef: { 男: [0, 90], 女: [0, 85] } });
D('hip', '臀围', 'cm', null, 'both', 'anthro');
D('whr', '腰臀比', '', [0, 0.9], 'high', 'anthro', { sexRef: { 男: [0, 0.9], 女: [0, 0.85] } });
D('bodyfat', '体脂率', '%', [10, 25], 'both', 'anthro', { sexRef: { 男: [10, 25], 女: [18, 32] } });
D('visceralfat', '内脏脂肪等级', '级', [0, 9], 'high', 'anthro');

/* ============================================================
   二、生命体征（6）
   ============================================================ */
D('sbp', '收缩压', 'mmHg', [90, 139], 'both', 'vital', { rule: 'bp' });
D('dbp', '舒张压', 'mmHg', [60, 89], 'both', 'vital', { rule: 'bp' });
D('pulse', '脉搏', '次/分', [60, 100], 'both', 'vital');
D('resprate', '呼吸频率', '次/分', [12, 20], 'both', 'vital');
D('temp', '体温', '℃', [36, 37.2], 'both', 'vital');
D('spo2', '血氧饱和度', '%', [95, 100], 'low', 'vital');

/* ============================================================
   三、眼科（6）
   ============================================================ */
D('visionR', '矫正视力（右）', '', [0.8, 2], 'low', 'eye', { rule: 'vision' });
D('visionL', '矫正视力（左）', '', [0.8, 2], 'low', 'eye', { rule: 'vision' });
D('iopR', '眼压（右）', 'mmHg', [10, 21], 'both', 'eye');
D('iopL', '眼压（左）', 'mmHg', [10, 21], 'both', 'eye');
D('colorvision', '色觉', '', null, 'both', 'eye');
D('fundus', '眼底检查', '', null, 'both', 'eye');

/* ============================================================
   四、血常规（26）
   ============================================================ */
D('wbc', '白细胞计数 WBC', '10^9/L', [3.5, 9.5], 'both', 'cbcW');
D('rbc', '红细胞计数 RBC', '10^12/L', [4.3, 5.8], 'both', 'cbcR', { sexRef: { 男: [4.3, 5.8], 女: [3.8, 5.1] } });
D('hgb', '血红蛋白 HGB', 'g/L', [130, 175], 'both', 'cbcR', { sexRef: { 男: [130, 175], 女: [115, 150] } });
D('hct', '红细胞压积 HCT', 'L/L', [0.40, 0.50], 'both', 'cbcR', { sexRef: { 男: [0.40, 0.50], 女: [0.35, 0.45] } });
D('mcv', '平均红细胞体积 MCV', 'fL', [82, 100], 'both', 'cbcR');
D('mch', '平均 HGB 含量 MCH', 'pg', [27, 34], 'both', 'cbcR');
D('mchc', '平均 HGB 浓度 MCHC', 'g/L', [316, 354], 'both', 'cbcR');
D('rdwcv', '红细胞体积分布宽度 CV', '%', [12.2, 14.8], 'both', 'cbcR', { rule: 'rdw' });
D('rdwsd', '红细胞体积分布宽度 SD', 'fL', [41.2, 53.6], 'both', 'cbcR', { rule: 'rdw' });
D('plt', '血小板计数 PLT', '10^9/L', [125, 350], 'both', 'cbcP');
D('pct', '血小板压积 PCT', '%', [0.19, 0.39], 'both', 'cbcP');
D('mpv', '平均血小板体积 MPV', 'fL', [9.2, 12.0], 'both', 'cbcP');
D('pdw', '血小板体积分布宽度 PDW', 'fL', [9.6, 15.2], 'both', 'cbcP');
D('plcr', '大血小板比率 P-LCR', '%', [19.7, 42.4], 'both', 'cbcP');
D('neutp', '中性粒细胞百分比 NEUT%', '%', [40, 75], 'both', 'cbcW');
D('neut', '中性粒细胞绝对值 NEUT#', '10^9/L', [1.8, 6.3], 'both', 'cbcW');
D('lymphp', '淋巴细胞百分比 LYMPH%', '%', [20, 50], 'both', 'cbcW', { rule: 'lymph' });
D('lymph', '淋巴细胞绝对值 LYMPH#', '10^9/L', [1.1, 3.2], 'both', 'cbcW', { rule: 'lymph' });
D('monop', '单核细胞百分比 MONO%', '%', [3, 10], 'both', 'cbcW');
D('mono', '单核细胞绝对值 MONO#', '10^9/L', [0.10, 0.60], 'both', 'cbcW');
D('eop', '嗜酸细胞百分比 EO%', '%', [0.4, 8], 'both', 'cbcW');
D('eo', '嗜酸细胞绝对值 EO#', '10^9/L', [0.02, 0.52], 'both', 'cbcW');
D('basop', '嗜碱细胞百分比 BASO%', '%', [0, 1], 'high', 'cbcW');
D('baso', '嗜碱细胞绝对值 BASO#', '10^9/L', [0, 0.06], 'high', 'cbcW');
D('nrbc', '有核红细胞', '%', [0, 0], 'high', 'cbcR');
D('esr', '红细胞沉降率 ESR', 'mm/h', [0, 15], 'high', 'inflam', { sexRef: { 男: [0, 15], 女: [0, 20] } });

/* ============================================================
   五、血脂（7）
   ============================================================ */
D('tc', '总胆固醇 TC', 'mmol/L', [3.1, 5.2], 'high', 'lipid');
D('tg', '甘油三酯 TG', 'mmol/L', [0.4, 1.82], 'high', 'lipid', { rule: 'tg' });
D('ldl', '低密度脂蛋白胆固醇 LDL-C', 'mmol/L', [0, 3.4], 'high', 'lipid', { rule: 'ldl' });
D('hdl', '高密度脂蛋白胆固醇 HDL-C', 'mmol/L', [1.16, 1.42], 'both', 'lipid', { rule: 'hdl', benignMax: 2.5 });
D('vldl', '极低密度脂蛋白胆固醇', 'mmol/L', [0, 0.78], 'high', 'lipid');
D('apoa1', '载脂蛋白 A1', 'g/L', [1.0, 1.6], 'low', 'lipid');
D('apob', '载脂蛋白 B', 'g/L', [0, 1.1], 'high', 'lipid');

/* ============================================================
   六、血糖与胰岛素（4）
   ============================================================ */
D('fbg', '血糖（空腹）', 'mmol/L', [3.9, 6.1], 'both', 'glucose', { rule: 'fbg' });
D('hba1c', '糖化血红蛋白 HbA1c', '%', [4, 6], 'high', 'glucose');
D('insulin', '空腹胰岛素', 'μU/mL', [2.6, 24.9], 'both', 'glucose');
D('homair', '胰岛素抵抗指数 HOMA-IR', '', [0, 2.7], 'high', 'glucose');

/* ============================================================
   七、肝功能（12）
   ============================================================ */
D('alt', '丙氨酸氨基转移酶 ALT', 'U/L', [9, 50], 'high', 'liver', { rule: 'alt' });
D('ast', '天门冬氨酸氨基转移酶 AST', 'U/L', [15, 40], 'high', 'liver');
D('astalt', 'AST:ALT 比值', '', [0.6, 1.4], 'both', 'liver');
D('ggt', 'γ-谷氨酰基转移酶 GGT', 'U/L', [10, 60], 'high', 'liver');
D('alp', '碱性磷酸酶 ALP', 'U/L', [45, 125], 'both', 'liver');
D('tbil', '总胆红素 TBIL', 'μmol/L', [0, 23], 'high', 'liver');
D('dbil', '直接胆红素 DBIL', 'μmol/L', [0, 6.84], 'high', 'liver');
D('ibil', '间接胆红素 IBIL', 'μmol/L', [0, 16], 'high', 'liver');
D('tp', '总蛋白 TP', 'g/L', [65, 85], 'both', 'liver');
D('alb', '白蛋白 ALB', 'g/L', [40, 55], 'both', 'liver');
D('glob', '球蛋白 GLB', 'g/L', [20, 40], 'both', 'liver');
D('ag', '白球比 A/G', '', [1.2, 2.4], 'both', 'liver');

/* ============================================================
   八、肾功能（7）
   ============================================================ */
D('cr', '肌酐 Cr', 'μmol/L', [57, 97], 'both', 'renal', { sexRef: { 男: [57, 97], 女: [41, 73] } });
D('urea', '尿素 Urea', 'mmol/L', [3.1, 8.0], 'both', 'renal');
D('uric', '尿酸 UA', 'μmol/L', [208, 428], 'high', 'renal', { rule: 'uric', sexRef: { 男: [208, 428], 女: [155, 357] } });
D('egfr', '肾小球滤过率 eGFR', 'ml/min', [90, 200], 'low', 'renal');
D('cysc', '胱抑素 C', 'mg/L', [0.51, 1.09], 'high', 'renal');
D('bunCr', '尿素/肌酐比值', '', [10, 20], 'both', 'renal');
D('microalb', '尿微量白蛋白', 'mg/L', [0, 30], 'high', 'renal');

/* ============================================================
   九、电解质（6）
   ============================================================ */
D('k', '血钾 K', 'mmol/L', [3.5, 5.3], 'both', 'electro');
D('na', '血钠 Na', 'mmol/L', [137, 147], 'both', 'electro');
D('cl', '血氯 Cl', 'mmol/L', [99, 110], 'both', 'electro');
D('ca', '血钙 Ca', 'mmol/L', [2.11, 2.52], 'both', 'electro');
D('p', '血磷 P', 'mmol/L', [0.85, 1.51], 'both', 'electro');
D('mg', '血镁 Mg', 'mmol/L', [0.75, 1.02], 'both', 'electro');

/* ============================================================
   十、心肌酶（5）
   ============================================================ */
D('ck', '肌酸激酶 CK', 'U/L', [50, 310], 'high', 'cardiac', { sexRef: { 男: [50, 310], 女: [40, 200] } });
D('ckmb', '肌酸激酶同工酶 CK-MB', 'U/L', [0, 24], 'high', 'cardiac');
D('ldh', '乳酸脱氢酶 LDH', 'U/L', [120, 250], 'high', 'cardiac');
D('hbdh', 'α-羟丁酸脱氢酶', 'U/L', [72, 182], 'high', 'cardiac');
D('trop', '肌钙蛋白 cTnI', 'ng/mL', [0, 0.04], 'high', 'cardiac');

/* ============================================================
   十一、炎症指标（3）
   ============================================================ */
D('crp', 'C 反应蛋白 CRP', 'mg/L', [0, 8], 'high', 'inflam');
D('hscrp', '超敏 C 反应蛋白 hs-CRP', 'mg/L', [0, 3], 'high', 'inflam');
D('procalc', '降钙素原 PCT', 'ng/mL', [0, 0.05], 'high', 'inflam');

/* ============================================================
   十二、甲状腺（5）
   ============================================================ */
D('tsh', '促甲状腺激素 TSH', 'mIU/L', [0.27, 4.2], 'both', 'thyroid', { rule: 'tsh' });
D('ft3', '游离三碘甲状腺原氨酸 FT3', 'pmol/L', [3.1, 6.8], 'both', 'thyroid');
D('ft4', '游离甲状腺素 FT4', 'pmol/L', [12, 22], 'both', 'thyroid');
D('tpoab', '甲状腺过氧化物酶抗体 TPOAb', 'IU/mL', [0, 34], 'high', 'thyroid');
D('tgab', '甲状腺球蛋白抗体 TgAb', 'IU/mL', [0, 115], 'high', 'thyroid');

/* ============================================================
   十三、同型半胱氨酸（1）
   ============================================================ */
D('hcy', '血同型半胱氨酸 Hcy', 'μmol/L', [0, 15], 'high', 'hcy', { rule: 'hcy' });

/* ============================================================
   十四、尿常规（14）
   ============================================================ */
D('ucolor', '尿液颜色', '', null, 'both', 'urine');
D('uclear', '尿液透明度', '', null, 'both', 'urine');
D('uph', '尿液 pH 值', '', [4.5, 8.0], 'both', 'urine');
D('usg', '尿比重', '', [1.003, 1.030], 'both', 'urine');
D('upro', '尿蛋白', '', null, 'high', 'urine');
D('uglu', '尿糖', '', null, 'high', 'urine');
D('uket', '尿酮体', '', null, 'high', 'urine');
D('ublood', '尿潜血', '', null, 'high', 'urine');
D('ubil', '尿胆红素', '', null, 'high', 'urine');
D('uurobg', '尿胆原', '', null, 'high', 'urine');
D('uwbc', '尿白细胞', '', null, 'high', 'urine');
D('unitrite', '尿亚硝酸盐', '', null, 'high', 'urine');
D('uleu', '尿白细胞酯酶', '', null, 'high', 'urine');
D('urbc', '尿红细胞计数', '/μL', [0, 25], 'high', 'urine');

/* ============================================================
   十五、肺功能（4）
   ============================================================ */
D('fev1', 'FEV1（占预计值）', '%', [80, 120], 'low', 'lung');
D('fvc', 'FVC（占预计值）', '%', [80, 120], 'low', 'lung');
D('fev1fvc', 'FEV1/FVC', '%', [70, 100], 'low', 'lung', { rule: 'lung' });
D('pef', '呼气峰流速 PEF', '%', [80, 120], 'low', 'lung');

/* ============================================================
   十六、肿瘤标志物（11）
   ============================================================ */
D('afp', '甲胎蛋白 AFP', 'ng/mL', [0, 10], 'high', 'tumor');
D('cea', '癌胚抗原 CEA', 'ng/mL', [0, 5], 'high', 'tumor');
D('ca199', '糖类抗原 19-9', 'U/mL', [0, 35], 'high', 'tumor');
D('ca125', '糖类抗原 12-5', 'U/mL', [0, 35], 'high', 'tumor');
D('ca153', '糖类抗原 15-3', 'U/mL', [0, 25], 'high', 'tumor');
D('ca724', '糖类抗原 72-4', 'U/mL', [0, 6.9], 'high', 'tumor');
D('cyfra21', '细胞角蛋白 19 片段', 'ng/mL', [0, 3.3], 'high', 'tumor');
D('nse', '神经元特异性烯醇化酶 NSE', 'ng/mL', [0, 16.3], 'high', 'tumor');
D('scc', '鳞状细胞癌抗原 SCC', 'ng/mL', [0, 1.5], 'high', 'tumor');
D('tpsa', '总前列腺特异性抗原 TPSA', 'ng/mL', [0, 4], 'high', 'tumor', { rule: 'prostate' });
D('fpsa', '游离前列腺特异性抗原 FPSA', 'ng/mL', [0, 1], 'high', 'tumor');

/* ============================================================
   十七、乙肝五项（5）
   ============================================================ */
D('hbsag', '乙肝表面抗原 HBsAg', '', null, 'high', 'hepatitis');
D('hbsab', '乙肝表面抗体 HBsAb', '', null, 'low', 'hepatitis');
D('hbeag', '乙肝 e 抗原 HBeAg', '', null, 'high', 'hepatitis');
D('hbeab', '乙肝 e 抗体 HBeAb', '', null, 'high', 'hepatitis');
D('hbcab', '乙肝核心抗体 HBcAb', '', null, 'high', 'hepatitis');

/* ============================================================
   十八、免疫（6）
   ============================================================ */
D('iga', '免疫球蛋白 A', 'g/L', [0.7, 4.0], 'both', 'immune');
D('igg', '免疫球蛋白 G', 'g/L', [7, 16], 'both', 'immune');
D('igm', '免疫球蛋白 M', 'g/L', [0.4, 2.3], 'both', 'immune');
D('c3', '补体 C3', 'g/L', [0.9, 1.8], 'both', 'immune');
D('c4', '补体 C4', 'g/L', [0.1, 0.4], 'both', 'immune');
D('ana', '抗核抗体 ANA', '', null, 'high', 'immune');

/* ============================================================
   十九、凝血（4）
   ============================================================ */
D('pt', '凝血酶原时间 PT', 's', [11, 14.5], 'both', 'coag');
D('aptt', '活化部分凝血活酶时间 APTT', 's', [28, 45], 'both', 'coag');
D('tt', '凝血酶时间 TT', 's', [14, 21], 'both', 'coag');
D('fib', '纤维蛋白原 FIB', 'g/L', [2, 4], 'both', 'coag');

/* ============================================================
   二十、维生素与铁代谢（7）
   ============================================================ */
D('vitd', '25-羟维生素 D', 'ng/mL', [30, 100], 'low', 'vitamin');
D('vitb12', '维生素 B12', 'pg/mL', [200, 900], 'low', 'vitamin');
D('folate', '叶酸', 'ng/mL', [3.1, 20], 'low', 'vitamin');
D('ferritin', '铁蛋白', 'ng/mL', [30, 400], 'both', 'vitamin', { sexRef: { 男: [30, 400], 女: [13, 150] } });
D('si', '血清铁', 'μmol/L', [9, 30], 'both', 'vitamin');
D('tibc', '总铁结合力', 'μmol/L', [45, 75], 'both', 'vitamin');
D('tsat', '转铁蛋白饱和度', '%', [20, 50], 'both', 'vitamin');

/* ============================================================
   二十一、性激素与其他（6）
   ============================================================ */
D('testo', '睾酮', 'ng/mL', [1.75, 7.81], 'both', 'hormone');
D('e2', '雌二醇 E2', 'pg/mL', [0, 60], 'both', 'hormone');
D('lh', '促黄体生成素 LH', 'mIU/mL', [1.7, 8.6], 'both', 'hormone');
D('fsh', '促卵泡刺激素 FSH', 'mIU/mL', [1.5, 12.4], 'both', 'hormone');
D('prl', '催乳素 PRL', 'ng/mL', [4, 15], 'both', 'hormone');
D('pth', '甲状旁腺激素 PTH', 'pg/mL', [15, 65], 'both', 'electro');

/* ============================================================
   二十二、其他检查（8）
   ============================================================ */
D('c13', 'C13 呼气试验', '', [-4, 3.9], 'high', 'hp');
D('c14', 'C14 呼气试验', 'dpm', [0, 100], 'high', 'hp');
D('abo', 'ABO 血型', '', null, 'both', 'other');
D('rh', 'Rh 血型', '', null, 'both', 'other');
D('bmd', '骨密度 T 值', '', [-1, 99], 'both', 'bone');
D('ankle', '踝臂指数 ABI', '', [0.9, 1.4], 'both', 'other');
D('pwv', '脉搏波传导速度 PWV', 'cm/s', [0, 1400], 'high', 'other');
D('hiv', 'HIV 抗体', '', null, 'high', 'other');

/* ============================================================
   二十三、影像与形态学（17）
   这些没有数值，只有描述；status 由报告判读给出
   ============================================================ */
D('fattyliver', '肝脏（腹部超声）', '', null, 'both', 'imgLiver', { rule: 'fattyliver', imaging: true });
D('livercyst', '肝囊肿', '', null, 'both', 'imgBenign', { imaging: true });
D('gallstone', '胆囊结石', '', null, 'both', 'imgGall', { imaging: true });
D('gallpolyp', '胆囊息肉', '', null, 'both', 'imgGall', { imaging: true });
D('thyroid', '甲状腺（超声）', '', null, 'both', 'imgThyroid', { rule: 'thyroid', imaging: true });
D('carotid', '颈动脉（超声）', '', null, 'both', 'imgVessel', { imaging: true });
D('ecg', '心电图', '', null, 'both', 'imgEcg', { imaging: true });
D('lungfunc', '肺功能（报告判读）', '', null, 'both', 'imgLung', { imaging: true });
D('prostate', '前列腺（超声）', '', null, 'both', 'imgProstate', { rule: 'prostate', imaging: true });
D('kidney', '双肾（超声）', '', null, 'both', 'imgKidney', { imaging: true });
D('urinary', '泌尿系（超声）', '', null, 'both', 'imgKidney', { imaging: true });
D('pancreas', '胰腺（超声）', '', null, 'both', 'imgBenign', { imaging: true });
D('spleen', '脾脏（超声）', '', null, 'both', 'imgBenign', { imaging: true });
D('uterus', '子宫（超声）', '', null, 'both', 'imgGyn', { imaging: true });
D('ovary', '卵巢（超声）', '', null, 'both', 'imgGyn', { imaging: true });
D('breast', '乳腺（超声）', '', null, 'both', 'imgBreast', { imaging: true });
D('ent', '耳鼻喉', '', null, 'both', 'imgEnt', { imaging: true });
D('dental', '口腔', '', null, 'both', 'imgEnt', { imaging: true });
D('skin', '皮肤', '', null, 'both', 'imgEnt', { imaging: true });
D('gastroscopy', '胃镜', '', null, 'both', 'imgGi', { imaging: true });
D('colonoscopy', '肠镜', '', null, 'both', 'imgGi', { imaging: true });
D('chestxray', '胸部 X 线', '', null, 'both', 'imgChest', { imaging: true });
D('ct', '胸部 CT', '', null, 'both', 'imgChest', { imaging: true });

/* ============================================================
   二十四、补齐到 200 项（16）
   ============================================================ */
D('ogtt2h', '餐后 2 小时血糖', 'mmol/L', [0, 7.8], 'high', 'glucose');
D('cpeptide', '空腹 C 肽', 'ng/mL', [1.1, 4.4], 'both', 'glucose');
D('che', '胆碱酯酶 CHE', 'U/L', [5000, 12000], 'both', 'liver');
D('ret', '网织红细胞百分比', '%', [0.5, 1.5], 'both', 'cbcR');
D('co2cp', '二氧化碳结合力', 'mmol/L', [22, 29], 'both', 'electro');
D('aso', '抗链球菌溶血素 O', 'IU/mL', [0, 200], 'high', 'inflam');
D('he4', '人附睾蛋白 4 HE4', 'pmol/L', [0, 140], 'high', 'tumor');
D('mthfr', 'MTHFR C677T 基因型', '', null, 'both', 'gene');
D('up24', '24 小时尿蛋白定量', 'g/24h', [0, 0.15], 'high', 'renal');
D('uacr', '尿白蛋白/肌酐比 UACR', 'mg/g', [0, 30], 'high', 'renal');
D('grip', '握力', 'kg', [28, 60], 'low', 'anthro', { sexRef: { 男: [28, 60], 女: [18, 45] } });
D('whtr', '腰高比', '', [0, 0.5], 'high', 'anthro');
D('thyroelastic', '甲状腺弹性评分', '', null, 'both', 'imgThyroid', { imaging: true });
D('mammography', '乳腺钼靶', '', null, 'both', 'imgBreast', { imaging: true });
D('hpab', '幽门螺杆菌抗体', '', null, 'high', 'hp');
D('tgprotein', '甲状腺球蛋白 Tg', 'ng/mL', [3.5, 77], 'both', 'thyroid');

/* ============================================================
   解读家族（HL.fam）
   ------------------------------------------------------------
   同一家族共用一套解释逻辑，文案里的 {name} {v} {u} {hi} {lo}
   {over} {under} 由引擎按实际数值填充。
   dept 为 null 表示「这一族轻微异常不需要跑医院」。
   ============================================================ */
HL.fam = {

  /* ---------- 体格 ---------- */
  anthro: {
    name: '体格测量', label: '体脂分布', domain: 'metabolic',
    whyHigh: '{name} {v} {u}，超出参考范围。体重相关的指标要一起看：BMI 看总量，腰围看脂肪堆在哪。腰围超标意味着脂肪主要堆在内脏，比单纯体重超标风险更高。',
    whyLow: '{name} {v} {u}，低于参考范围。体重过低同样会削弱免疫与骨密度，不是越瘦越好。',
    advice: ['把腰围当主指标，每周固定时间量一次（早晨空腹、同一位置）', '减重速度控制在每周 0.4–0.6kg，快于这个数掉的多是水和肌肉'],
    recheck: '每月自测腰围，随年度体检复查', grade: '实测'
  },

  vital: {
    name: '生命体征', label: '生命体征', domain: 'cardio',
    whyHigh: '{name} {v} {u}，高于参考范围。单次测量不足以定性，需要在不同日、不同时段重复测量才能判断。',
    whyLow: '{name} {v} {u}，低于参考范围。若伴头晕、乏力，需要就诊查明原因。',
    advice: ['家庭自测：静坐 5 分钟后测，早晚各一次，连续 7 天取平均', '记录时把当时的情绪、咖啡因、睡眠一起写上，判断更有依据'],
    recheck: '连续记录 7 天后带数据就诊', grade: '实测'
  },

  /* ---------- 眼科 ---------- */
  eye: {
    name: '眼科', label: '眼科检查', domain: 'sensory',
    whyHigh: '{name} {v} {u}，高于参考范围。眼压升高需要排查青光眼风险，这一项不能只看单次值。',
    whyLow: '{name} {v} {u}，低于参考范围。矫正视力不达标说明戴镜后仍看不清，需要重新验光或排查眼底问题。',
    advice: ['到眼科做一次完整验光 + 眼底检查', '长期用眼者每 40 分钟远眺 5 分钟，屏幕亮度与环境光接近'],
    dept: 'eye', recheck: '1 个月内到眼科复查', grade: '实测'
  },

  /* ---------- 血常规三系 ---------- */
  cbcR: {
    name: '红细胞系', label: '红细胞系', domain: 'blood',
    whyHigh: '{name} {v} {u}，高于参考范围。红细胞相关指标偏高常见于脱水、长期吸烟、高原居住，少数与骨髓增殖性疾病相关。先排除前三种。',
    whyLow: '{name} {v} {u}，低于参考范围。红细胞系偏低指向贫血，但要结合 MCV 判断类型：MCV 低多为缺铁，MCV 高要查 B12 与叶酸。',
    advice: ['先看 MCV 与铁蛋白：MCV 偏低 + 铁蛋白低 = 缺铁性贫血', '不要自行补铁，补之前先查铁蛋白，铁过载同样有害'],
    dept: 'hema', recheck: '3 个月后复查血常规 + 铁蛋白', grade: '实测'
  },

  cbcW: {
    name: '白细胞系', label: '白细胞系', domain: 'blood',
    whyHigh: '{name} {v} {u}，高于参考范围。白细胞升高最常见的原因是近期感染或炎症，其次才是血液系统问题。没有发热、没有症状的轻度升高，通常 2–4 周后复查即可。',
    whyLow: '{name} {v} {u}，低于参考范围。轻度偏低常见于病毒感染后、药物影响或个体差异，持续偏低才需要查原因。',
    advice: ['2–4 周后复查一次血常规，看是否自行回落', '复查前 3 天避免剧烈运动与饮酒，这两项会直接影响结果'],
    dept: 'hema', recheck: '2–4 周后复查血常规', grade: '实测'
  },

  cbcP: {
    name: '血小板', label: '血小板', domain: 'blood',
    whyHigh: '{name} {v} {u}，高于参考范围。血小板轻度升高多见于炎症、缺铁，反应性升高为主；持续显著升高才需排查骨髓问题。',
    whyLow: '{name} {v} {u}，低于参考范围。血小板偏低要留意出血倾向（牙龈出血、皮下瘀斑），明显降低需尽快就诊。',
    advice: ['2 周后复查一次，排除检验波动', '避免自行服用阿司匹林等影响凝血的药物'],
    dept: 'hema', recheck: '2 周后复查血常规', grade: '实测'
  },

  /* ---------- 血脂 ---------- */
  lipid: {
    name: '血脂', label: '血脂', domain: 'cardio',
    whyHigh: '{name} {v} {u}，高于参考上限 {hi}（超出 {over}%）。血脂里真正决定风险的是 LDL-C，它是动脉粥样硬化的直接推手；甘油三酯对饮食最敏感，断糖断酒 4–6 周就能看到回落。',
    whyLow: '{name} {v} {u}，低于参考范围。血脂过低少见，多与营养摄入不足或甲亢相关。',
    advice: ['减少动物油脂、油炸与加工肉；增加燕麦、豆类、深海鱼', '含糖饮料、果汁、酒精是甘油三酯的直接来源，先断这三样', '每周 150 分钟中等强度有氧，对血脂的改善独立于体重变化'],
    recheck: '3–6 个月后复查血脂四项', grade: '实测'
  },

  /* ---------- 血糖 ---------- */
  glucose: {
    name: '血糖', label: '糖代谢', domain: 'metabolic',
    whyHigh: '{name} {v} {u}，高于参考范围。血糖的判断要看三个数：空腹、餐后 2 小时、糖化血红蛋白。单看空腹会漏掉一部分餐后升高的人。',
    whyLow: '{name} {v} {u}，低于参考范围。低血糖比高血糖更急，若伴心慌、出汗、手抖，需要立即进食并查原因。',
    advice: ['加查糖化血红蛋白（HbA1c）与空腹胰岛素，算 HOMA-IR', '主食换成杂粮，先吃菜和蛋白再吃主食，餐后血糖会平很多', '餐后散步 15 分钟，是降餐后血糖最省力的办法'],
    dept: 'endo', recheck: '3 个月后复查血糖 + HbA1c', grade: '实测'
  },

  /* ---------- 肝功 ---------- */
  liver: {
    name: '肝功能', label: '肝酶与胆红素', domain: 'liver',
    whyHigh: '{name} {v} {u}，高于参考上限 {hi}（超出 {over}%）。肝酶升高说明肝细胞受到刺激或损伤。判断性质看三点：升高幅度、是 ALT 为主还是 AST 为主、有没有合并胆红素或 GGT 升高。脂肪肝是最常见的原因，其次是酒精与药物。',
    whyLow: '{name} {v} {u}，低于参考范围。肝功指标偏低多数没有临床意义，少数与营养状态相关。',
    advice: ['先断酒 4 周再复查，酒精对肝酶的影响很直接', '查一次腹部超声，确认有没有脂肪肝或胆道问题', '不要自行吃保肝药，多数「保肝」产品反而增加肝脏负担'],
    dept: 'gi', recheck: '1–3 个月后复查肝功', grade: '实测'
  },

  /* ---------- 肾功 ---------- */
  renal: {
    name: '肾功能', label: '肾功能', domain: 'renal',
    whyHigh: '{name} {v} {u}，高于参考范围。肾功能指标要结合 eGFR 一起看：肌酐受肌肉量影响大，健身人群偏高未必是问题。',
    whyLow: '{name} {v} {u}，低于参考范围。eGFR 偏低提示滤过功能下降，需要复查确认并排查原因。',
    advice: ['复查前 3 天避免高蛋白饮食与剧烈运动，这两项会推高肌酐', '每天饮水 1500–2000ml，不要长期憋尿', '慎用非甾体止痛药与来源不明的中草药'],
    dept: 'nephro', recheck: '3 个月后复查肾功 + 尿常规', grade: '实测'
  },

  /* ---------- 电解质 ---------- */
  electro: {
    name: '电解质', label: '电解质', domain: 'renal',
    whyHigh: '{name} {v} {u}，高于参考范围。电解质异常多与饮食、饮水、肾功能或药物相关，轻度偏离常可自行恢复。',
    whyLow: '{name} {v} {u}，低于参考范围。电解质偏低可能引起乏力、心悸、抽筋，明显偏离需要处理。',
    advice: ['复查一次确认不是检验误差', '不要自行大量补充电解质饮料，先查明是哪种离子偏离'],
    dept: null, recheck: '2 周后复查电解质', grade: '实测'
  },

  /* ---------- 心肌酶 ---------- */
  cardiac: {
    name: '心肌酶', label: '心肌酶', domain: 'cardio',
    whyHigh: '{name} {v} {u}，高于参考范围。心肌酶升高不一定来自心脏——剧烈运动、肌肉损伤、甚至抽血时的溶血都会让它升高。真正需要警惕的是肌钙蛋白升高，或伴随胸痛、胸闷。',
    whyLow: '{name} {v} {u}，低于参考范围，通常无临床意义。',
    advice: ['复查前 3 天避免剧烈运动，运动是 CK 升高最常见的原因', '若伴胸痛、胸闷、气短，不要等复查，直接就诊'],
    dept: 'cardio', recheck: '1–2 周后复查心肌酶谱', grade: '实测'
  },

  /* ---------- 炎症 ---------- */
  inflam: {
    name: '炎症指标', label: '炎症指标', domain: 'blood',
    whyHigh: '{name} {v} {u}，高于参考范围。这类指标只说明「身体某处有炎症」，不指位置。轻度升高常见于牙龈炎、皮肤感染、近期感冒，也可能与肥胖本身相关（脂肪组织会持续分泌炎症因子）。',
    whyLow: '{name} {v} {u}，低于参考范围，通常无临床意义。',
    advice: ['先排查常见炎症灶：牙周、皮肤、鼻窦、泌尿', '2–4 周后复查，看是否随感染痊愈回落'],
    dept: null, recheck: '2–4 周后复查', grade: '实测'
  },

  /* ---------- 甲状腺 ---------- */
  thyroid: {
    name: '甲状腺功能', label: '甲状腺功能', domain: 'endocrine',
    whyHigh: '{name} {v} {u}，高于参考范围。TSH 升高而 FT4 正常，是亚临床甲减的典型组合；如果同时 TPOAb 阳性，多指向桥本甲状腺炎。',
    whyLow: '{name} {v} {u}，低于参考范围。TSH 降低提示甲状腺激素偏多，需要结合 FT3、FT4 判断是甲亢还是亚临床甲亢。',
    advice: ['甲功与抗体一起查，单看 TSH 判断不了病因', '空腹上午抽血，避免生物素类保健品干扰结果'],
    dept: 'endo', recheck: '1–3 个月后复查甲功五项 + 抗体', grade: '实测'
  },

  hcy: {
    name: '同型半胱氨酸', label: '同型半胱氨酸', domain: 'cardio',
    whyHigh: '{name} {v} {u}，高于参考上限 {hi}（超出 {over}%）。Hcy 会直接损伤血管内皮、促进氧化应激与血栓倾向，是独立于血脂之外的心脑血管风险因素。常见原因是叶酸或 B12 摄入不足、MTHFR 基因变异。好消息是它对补充叶酸的反应通常很好。',
    whyLow: '{name} {v} {u}，低于参考范围，无临床意义。',
    advice: ['查一次血清叶酸 + 维生素 B12，判断是缺乏型还是代谢型', '每天 300–400g 深绿叶菜，急火快炒或焯水 30 秒', '叶酸补充剂需由医生决定剂量，不要长期自行大剂量服用'],
    dept: 'cardio', recheck: '3 个月后复查 Hcy + 叶酸 + B12', grade: '实测'
  },

  /* ---------- 尿常规 ---------- */
  urine: {
    name: '尿常规', label: '尿常规', domain: 'renal',
    whyHigh: '{name} 呈阳性，正常应为阴性。尿常规是最容易被「污染」的检查——取样不规范、女性经期、近期剧烈运动都会造成假阳性。所以第一次阳性先别紧张，规范取样复查一次。',
    whyLow: '{name} {v}，低于参考范围，通常无临床意义。',
    advice: ['复查时取晨起第一次尿的中段，前一晚不要剧烈运动', '若复查仍阳性，加做尿沉渣镜检与泌尿系超声'],
    dept: 'nephro', recheck: '2 周后规范取样复查尿常规', grade: '实测'
  },

  /* ---------- 肺功能 ---------- */
  lung: {
    name: '肺功能', label: '肺通气功能', domain: 'respiratory',
    whyHigh: '{name} {v} {u}，高于参考范围，通常无临床意义。',
    whyLow: '{name} {v} {u}，低于参考范围。肺功能是「用力吹气」的检查，很依赖配合度，一次结果不达标不能直接下结论，需要复查确认。',
    advice: ['1 个月内复查肺功能，复查前 24 小时不做高强度运动', '复查时按技师口令全力吹，配合度直接影响结果', '吸烟者戒烟是唯一能改变肺功能下降速度的措施'],
    dept: 'resp', recheck: '1 个月内复查肺功能', grade: '实测'
  },

  /* ---------- 肿瘤标志物 ---------- */
  tumor: {
    name: '肿瘤标志物', label: '肿瘤标志物', domain: 'sensory',
    whyHigh: '{name} {v} {u}，高于参考范围。这一类指标最容易被误读：它升高不等于有肿瘤，炎症、良性疾病、甚至吸烟都会让它升高；它正常也不能排除肿瘤。正确的用法是看趋势和幅度——轻度升高复查，持续成倍升高才需要进一步检查。',
    whyLow: '{name} {v} {u}，低于参考范围，无临床意义。',
    advice: ['4–6 周后复查同一项，看是回落还是继续升', '结合影像检查判断，单靠标志物不能定位', '不要因为一项轻度升高就去做全身 CT'],
    dept: null, recheck: '4–6 周后复查同一项', grade: '实测'
  },

  /* ---------- 乙肝 ---------- */
  hepatitis: {
    name: '乙肝五项', label: '乙肝五项', domain: 'liver',
    whyHigh: '{name} 阳性。乙肝五项的每一项含义不同，需要组合起来读，单看一项会误判。',
    whyLow: '{name} 阴性。表面抗体阴性说明没有保护性抗体，可考虑接种乙肝疫苗。',
    advice: ['把五项结果一起给感染科或肝病科看，不要单项解读', '表面抗体阴性者可按 0-1-6 方案接种乙肝疫苗'],
    dept: 'gi', recheck: '3–6 个月后复查乙肝五项', grade: '实测'
  },

  /* ---------- 免疫 ---------- */
  immune: {
    name: '免疫指标', label: '免疫指标', domain: 'blood',
    whyHigh: '{name} {v} {u}，高于参考范围。免疫球蛋白升高可见于慢性炎症、自身免疫病、肝病，轻度升高常无明确意义。',
    whyLow: '{name} {v} {u}，低于参考范围。免疫球蛋白偏低要留意反复感染的情况。',
    advice: ['复查一次确认，同时看有没有反复感染、皮疹、关节痛', '单项轻度异常不必过度检查，结合症状判断'],
    dept: null, recheck: '3 个月后复查', grade: '实测'
  },

  /* ---------- 凝血 ---------- */
  coag: {
    name: '凝血功能', label: '凝血功能', domain: 'blood',
    whyHigh: '{name} {v} {u}，高于参考范围。凝血时间延长要留意出血倾向，也可能与药物（如抗凝药）相关。',
    whyLow: '{name} {v} {u}，低于参考范围。凝血时间缩短多见于炎症或高凝状态。',
    advice: ['复查一次，并告知医生正在服用的所有药物与保健品', '术前、拔牙前务必把这项结果给医生看'],
    dept: 'hema', recheck: '2 周后复查凝血四项', grade: '实测'
  },

  /* ---------- 维生素与铁 ---------- */
  vitamin: {
    name: '维生素与铁代谢', label: '维生素与铁', domain: 'blood',
    whyHigh: '{name} {v} {u}，高于参考范围。铁蛋白升高常见于炎症、脂肪肝、饮酒，不一定是铁过量。',
    whyLow: '{name} {v} {u}，低于参考范围。维生素 D 偏低在城市人群里极常见，与久坐、日晒少直接相关；B12 与叶酸偏低会推高同型半胱氨酸。',
    advice: ['维生素 D 偏低：每天日晒 15–20 分钟，或按医嘱补充', 'B12 与叶酸偏低：增加动物肝脏、蛋类、深绿叶菜', '补铁前必须先查铁蛋白，铁过载比缺铁更难处理'],
    dept: null, recheck: '3 个月后复查', grade: '实测'
  },

  /* ---------- 性激素 ---------- */
  hormone: {
    name: '性激素', label: '性激素', domain: 'endocrine',
    whyHigh: '{name} {v} {u}，高于参考范围。性激素水平随月经周期、作息、压力波动很大，单次结果参考价值有限。',
    whyLow: '{name} {v} {u}，低于参考范围。需结合年龄、症状与其他激素一起判断。',
    advice: ['女性建议在月经第 2–4 天上午空腹抽血，结果才可比', '复查一次再判断，不要凭单次结果用药'],
    dept: 'endo', recheck: '1–3 个月后复查', grade: '实测'
  },

  /* ---------- 幽门螺杆菌 ---------- */
  hp: {
    name: '幽门螺杆菌', label: '幽门螺杆菌', domain: 'liver',
    whyHigh: '{name} 提示幽门螺杆菌阳性。我国成人感染率约 40–50%，感染不等于发病，但它与慢性胃炎、胃溃疡、胃癌风险相关。',
    whyLow: '{name} 阴性，未检出幽门螺杆菌感染。',
    advice: ['做一次胃镜评估胃黏膜状态，再决定是否根除', '根除需规范四联疗法 14 天，不要自行买药', '家庭成员建议同期检测，存在家庭内传播'],
    dept: 'gi', recheck: '根除后 4 周复查呼气试验', grade: '实测'
  },

  bone: {
    name: '骨代谢', label: '骨代谢', domain: 'sensory',
    whyHigh: '{name} {v}，高于参考范围。',
    whyLow: '{name} {v}，低于参考范围，提示骨量减少。40 岁后骨量自然下降，负重运动与足量钙和维生素 D 是唯一有效的干预。',
    advice: ['每周 2–3 次负重运动（快走、深蹲、爬楼），比补钙更重要', '每天奶制品 300ml + 深绿叶菜，配合日晒'],
    dept: 'ortho', recheck: '1–2 年后复查骨密度', grade: '实测'
  },

  gene: {
    name: '基因检测', label: '基因型', domain: 'cardio',
    whyHigh: '{name} 检出变异型。基因型不会变，它解释的是「为什么你的某项指标容易偏高」，不是疾病本身。',
    whyLow: '{name} 未检出变异型。',
    advice: ['MTHFR C677T 变异者，叶酸利用率偏低，需用活性叶酸并定期复查 Hcy'],
    dept: null, recheck: '不需复查，一次检测终身有效', grade: '实测'
  },

  other: {
    name: '其他检查', label: '其他检查', domain: 'sensory',
    whyHigh: '{name} {v} {u}，高于参考范围。',
    whyLow: '{name} {v} {u}，低于参考范围。',
    advice: ['复查一次确认，结合症状判断'],
    dept: null, recheck: '3 个月后复查', grade: '实测'
  },

  /* ============================================================
     影像与形态学家族
     这类项没有数值，只有报告里的一段描述。家族负责回答
     「这段描述意味着什么、下一步做什么」，不重复报告原文。
     ============================================================ */
  imgLiver: {
    name: '肝脏影像', label: '肝脏影像', domain: 'liver',
    note: '肝脏超声看的是形态与回声。脂肪肝在超声上表现为「回声增强、后方衰减」，它提示肝内脂肪堆积，但看不出肝细胞有没有发炎——那要靠肝功。',
    advice: ['查肝功确认有没有合并肝细胞损伤', '减重 5–8% 是逆转脂肪肝最确切的干预'],
    dept: 'gi', recheck: '6–12 个月复查腹部超声', grade: '实测'
  },

  imgBenign: {
    name: '良性影像发现', label: '良性影像发现', domain: 'liver',
    note: '囊肿、钙化灶、血管瘤这类描述在体检报告里非常常见，绝大多数是良性且不需要处理的。它们的价值在于「留个底」——下次体检对比大小变化即可。',
    advice: ['记录大小，下次体检对比是否变化', '没有症状、没有变化就不需要干预'],
    dept: null, recheck: '随年度体检复查', grade: '实测'
  },

  imgGall: {
    name: '胆囊', label: '胆囊', domain: 'liver',
    note: '胆囊结石与息肉是否处理，取决于三件事：有没有症状、结石大小、息肉大小与生长速度。无症状的小结石通常观察，息肉 ≥10mm 或快速增大需要外科评估。',
    advice: ['记录大小与数量，6–12 个月复查对比', '出现右上腹绞痛、进食油腻后不适，及时就诊', '不要因为「有结石」就自行排石，可能诱发胆管梗阻'],
    dept: 'gi', recheck: '6–12 个月复查腹部超声', grade: '实测'
  },

  imgThyroid: {
    name: '甲状腺影像', label: '甲状腺影像', domain: 'endocrine',
    note: '甲状腺结节的关键不是「有没有」，而是 TI-RADS 分级与大小。3 类及以下恶性风险很低，通常随访；4 类以上需要进一步评估。超声只看形态，看不到激素水平。',
    advice: ['补查甲功五项 + TPOAb + TgAb，超声替代不了激素', '按 TI-RADS 分级决定随访间隔，不要一律半年一次', '结节 ≥1cm 且分级 ≥4 类，考虑穿刺活检'],
    dept: 'endo', recheck: '6–12 个月复查甲状腺超声', grade: '实测'
  },

  imgVessel: {
    name: '血管超声', label: '血管超声', domain: 'cardio',
    note: '颈动脉超声看的是动脉粥样硬化的「现场证据」——内-中膜厚度与斑块。它比血脂数字更直接：血脂高不一定有斑块，有斑块则说明硬化过程已经启动。',
    advice: ['有斑块者把 LDL-C 目标降到 1.8 以下，比一般人更严', '戒烟是唯一能明确减缓斑块进展的措施', '每年复查一次颈动脉超声对比'],
    dept: 'cardio', recheck: '6–12 个月复查颈动脉超声', grade: '实测'
  },

  imgEcg: {
    name: '心电图', label: '心电图', domain: 'cardio',
    note: '心电图是一次 10 秒的快照，抓不到阵发性的问题。报告写「窦性心律、正常心电图」就是没问题；写「ST-T 改变」「早搏」「传导阻滞」才需要结合症状判断。',
    advice: ['有胸闷、心悸症状时，做 24 小时动态心电图比单次更准', '心电图异常 + 有症状，尽快到心内科就诊'],
    dept: 'cardio', recheck: '随年度体检复查', grade: '实测'
  },

  imgLung: {
    name: '肺部影像', label: '肺部影像', domain: 'respiratory',
    note: '肺功能是「用力吹气」的检查，很依赖配合度；胸部影像看的是结构。两者互补，不能互相替代。',
    advice: ['肺功能异常 1 个月内复查，复查前 24 小时不做高强度运动', '胸部 CT 发现结节，按结节大小与密度决定随访间隔'],
    dept: 'resp', recheck: '1 个月内复查肺功能', grade: '实测'
  },

  imgProstate: {
    name: '前列腺', label: '前列腺', domain: 'renal',
    note: '前列腺钙化灶多是既往炎症愈合后的痕迹，无症状不需要处理。真正需要关注的是体积增大（伴排尿症状）与 TPSA 升高。',
    advice: ['无症状的钙化灶不需要治疗，随年度体检复查', '出现夜尿增多、排尿费力，查 TPSA 与残余尿'],
    dept: 'uro', recheck: '随年度体检复查', grade: '实测'
  },

  imgKidney: {
    name: '泌尿系影像', label: '泌尿系影像', domain: 'renal',
    note: '肾结石、肾囊肿、肾盂扩张的处理原则不同：无症状小结石观察，囊肿看大小，肾盂扩张要排除梗阻。',
    advice: ['记录结石大小与位置，5mm 以下多数可自行排出', '每天饮水 2000ml 以上，是预防结石最有效的一条'],
    dept: 'uro', recheck: '6–12 个月复查泌尿系超声', grade: '实测'
  },

  imgGyn: {
    name: '妇科影像', label: '妇科影像', domain: 'sensory',
    note: '子宫肌瘤、卵巢囊肿在育龄女性中很常见，处理与否取决于大小、生长速度与症状（月经量、腹痛）。',
    advice: ['记录大小，3–6 个月复查对比生长速度', '月经量明显增多、经期延长、下腹坠胀，及时到妇科就诊'],
    dept: 'gyn', recheck: '3–6 个月复查妇科超声', grade: '实测'
  },

  imgBreast: {
    name: '乳腺影像', label: '乳腺影像', domain: 'sensory',
    note: '乳腺超声与钼靶按 BI-RADS 分级判断。3 类及以下定期随访，4 类以上需要进一步检查。',
    advice: ['按 BI-RADS 分级决定随访间隔，不要凭「有结节」自行判断', '40 岁以上建议每年一次乳腺超声 + 钼靶'],
    dept: 'surg', recheck: '6–12 个月复查乳腺超声', grade: '实测'
  },

  imgEnt: {
    name: '五官与皮肤', label: '五官与皮肤', domain: 'sensory',
    note: '耳鼻喉、口腔、皮肤的体检发现多为慢性炎症或良性改变，重点在于有没有持续症状。',
    advice: ['有持续症状（鼻塞、咽痛、牙龈出血）时到相应专科就诊', '无症状者随年度体检复查'],
    dept: null, recheck: '随年度体检复查', grade: '实测'
  },

  imgGi: {
    name: '胃肠镜', label: '胃肠镜', domain: 'liver',
    note: '胃肠镜是唯一能「看到并取活检」的检查。报告里的描述（糜烂、溃疡、息肉、萎缩）比结论更重要，幽门螺杆菌状态要一起看。',
    advice: ['按病理结果决定复查间隔，不要一律一年一次', '幽门螺杆菌阳性者建议根除后再复查胃镜'],
    dept: 'gi', recheck: '按病理与分级决定，通常 1–3 年', grade: '实测'
  },

  imgChest: {
    name: '胸部影像', label: '胸部影像', domain: 'respiratory',
    note: '胸片对小结节不敏感，低剂量 CT 才是筛查手段。报告里的「结节」「磨玻璃影」「条索影」含义不同，要看大小与随访建议。',
    advice: ['CT 报结节者按大小随访：<6mm 年度复查，6–8mm 半年复查', '吸烟者建议每年一次低剂量胸部 CT'],
    dept: 'resp', recheck: '按结节大小决定随访间隔', grade: '实测'
  }
};

/* ============================================================
   指标名匹配：OCR 出来的名字不可能刚好等于字典 id
   ------------------------------------------------------------
   体检单上同一项至少三种写法：
     「血同型半胱氨酸」/「同型半胱氨酸」/「Hcy」
   各医院模板还不一样。引擎靠 it.id 精确匹配字典，接了 OCR 之后
   只要 id 对不上，这一项就静默消失——不报错、页面少一行，最难查。

   三层：别名表 → 归一化精确 → 缩写 → 包含（候选唯一）→ 编辑距离。
   宁可匹配不上（走家族兜底），也不能把「前白蛋白」错配成「白蛋白」。
   ============================================================ */
(function () {
  'use strict';

  /* 别名表：中文写法差异 + 英文缩写。
     算法解决不了「谷丙转氨酶」vs「丙氨酸氨基转移酶」这种，
     只能人工列。键统一小写。 */
  var ALIAS = {
    /* 肝功 */
    '谷丙转氨酶': 'alt', 'gpt': 'alt', '丙氨酸转氨酶': 'alt',
    '谷草转氨酶': 'ast', 'got': 'ast', '天冬氨酸氨基转移酶': 'ast',
    '谷氨酰转肽酶': 'ggt', 'γ-谷氨酰转肽酶': 'ggt', '转肽酶': 'ggt',
    'γ-gt': 'ggt', 'ggt': 'ggt',
    '总胆红素': 'tbil', '直接胆红素': 'dbil', '间接胆红素': 'ibil',
    '总蛋白': 'tp', '白蛋白': 'alb', '球蛋白': 'glob', '白球比': 'ag',
    '碱性磷酸酶': 'alp',
    /* 血脂 */
    '总胆固醇': 'tc', '胆固醇': 'tc', 'chol': 'tc', 'cho': 'tc',
    '甘油三酯': 'tg', '三酰甘油': 'tg',
    '高密度脂蛋白': 'hdl', 'hdl': 'hdl',
    '低密度脂蛋白': 'ldl', 'ldl': 'ldl',
    '载脂蛋白a1': 'apoa1', '载脂蛋白b': 'apob',
    'alt': 'alt', 'ast': 'ast', 'tc': 'tc', 'tg': 'tg',
    'hdl': 'hdl', 'hdl-c': 'hdl', 'ldl': 'ldl', 'ldl-c': 'ldl',
    'cr': 'cr', 'ua': 'uric',
    /* 血糖 */
    '血糖': 'fbg', '空腹血糖': 'fbg', '葡萄糖': 'fbg', 'glu': 'fbg', 'fpg': 'fbg',
    '糖化血红蛋白': 'hba1c', 'hba1c': 'hba1c', '餐后2小时血糖': 'ogtt2h',
    /* 肾功 */
    '肌酐': 'cr', 'crea': 'cr', 'scr': 'cr',
    '尿素': 'urea', '尿素氮': 'urea', 'bun': 'urea',
    '尿酸': 'uric', 'uric': 'uric', 'ua': 'uric',
    '肾小球滤过率': 'egfr', 'egfr': 'egfr', '胱抑素c': 'cysc',
    /* 血常规 */
    '白细胞': 'wbc', 'wbc': 'wbc', '红细胞': 'rbc', 'rbc': 'rbc',
    '血红蛋白': 'hgb', 'hb': 'hgb', 'hgb': 'hgb',
    '血小板': 'plt', 'plt': 'plt',
    '中性粒细胞百分比': 'neutp', '淋巴细胞百分比': 'lymphp',
    /* 甲功 */
    '促甲状腺激素': 'tsh', 'tsh': 'tsh',
    '游离t3': 'ft3', 'ft3': 'ft3', '游离三碘甲状腺原氨酸': 'ft3',
    '游离t4': 'ft4', 'ft4': 'ft4', '游离甲状腺素': 'ft4',
    /* 尿常规 */
    '尿蛋白': 'upro', '蛋白质': 'upro', 'pro': 'upro',
    '尿潜血': 'ublood', '隐血': 'ublood', '尿隐血': 'ublood', 'bld': 'ublood',
    '尿糖': 'uglu', '尿酮体': 'uket',
    /* 肿瘤标志物 */
    '癌胚抗原': 'cea', 'cea': 'cea', '甲胎蛋白': 'afp', 'afp': 'afp',
    /* 其他 */
    '同型半胱氨酸': 'hcy', '血同型半胱氨酸': 'hcy', 'hcy': 'hcy',
    '体重指数': 'bmi', 'bmi': 'bmi',
    '收缩压': 'sbp', '高压': 'sbp', 'sbp': 'sbp',
    '舒张压': 'dbp', '低压': 'dbp', 'dbp': 'dbp',
    '维生素d': 'vitd', '25羟维生素d': 'vitd', '25-羟维生素d': 'vitd', 'vd': 'vitd',
    '维生素b12': 'vitb12', 'vitb12': 'vitb12', 'b12': 'vitb12',
    '叶酸': 'folate',
    /* 电解质：体检单上常只写单字 */
    '钾': 'k', '钠': 'na', '氯': 'cl', '钙': 'ca'
  };

  /* 明确不该匹配的名字：字面相近但完全不是同一项。
     误配比匹配不上更糟——会给用户一段错误的解读。 */
  var EXCLUDE = /^(前白蛋白|糖化白蛋白|糖化血清蛋白|总t3|总t4|tt3|tt4|游离psa|fpsa|psa)$/;

  /* 归一化：全角转半角 → 去括号 → 剥英文串 → 去空白标点 → 小写。
     剥英文串是关键：字典名是「血同型半胱氨酸 Hcy」，
     不剥掉 Hcy，长度会多 3，包含匹配的比例算不过。 */
  function norm(s) {
    var t = String(s == null ? '' : s);
    t = t.replace(/[\uFF01-\uFF5E]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
    });
    t = t.replace(/[（(][^)）]*[)）]/g, '');
    t = t.replace(/[A-Za-z][A-Za-z0-9\-]{1,}/g, '');   /* 2 字母以上才剥，保留单个 D */
    t = t.replace(/[\s\u3000·・\-_\/\\,，、:：;；。.]/g, '');
    return t.toLowerCase();
  }

  /* 英文缩写：括号里的，或尾部独立的英文串（大小写混合都认） */
  function abbr(s) {
    var t = String(s == null ? '' : s);
    var m = t.match(/[（(]\s*([A-Za-z][A-Za-z0-9\-]{1,10})\s*[)）]/);
    if (m) return m[1].toUpperCase();
    m = t.match(/(?:^|[\s\u3000])([A-Za-z][A-Za-z0-9\-]{1,10})\s*$/);
    if (m) return m[1].toUpperCase();
    return '';
  }

  function dist(a, b) {
    if (a === b) return 0;
    var n = a.length, m = b.length;
    if (Math.abs(n - m) > 1) return 99;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= m; j++) prev[j] = j;
    for (i = 1; i <= n; i++) {
      cur[0] = i;
      for (j = 1; j <= m; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[m];
  }

  var IDX = null;
  function index() {
    if (IDX) return IDX;
    IDX = { byName: {}, byAbbr: {}, list: [] };
    HL.dict.forEach(function (d) {
      var n = norm(d.name);
      if (n) {
        if (IDX.byName[n] && IDX.byName[n] !== d.id) IDX.byName[n] = '__dup__';
        else IDX.byName[n] = d.id;
        IDX.list.push({ id: d.id, n: n });
      }
      var a = abbr(d.name);
      if (a) {
        if (IDX.byAbbr[a] && IDX.byAbbr[a] !== d.id) IDX.byAbbr[a] = '__dup__';
        else IDX.byAbbr[a] = d.id;
      }
    });
    /* 别名表并入：键可能是纯英文，norm 后为空，所以单独存 */
    Object.keys(ALIAS).forEach(function (k) {
      var id = ALIAS[k];
      if (!HL.dictById[id]) return;                 /* 别名指向不存在的 id，跳过 */
      var nk = norm(k);
      if (nk && !IDX.byName[nk]) IDX.byName[nk] = id;
      IDX.byAbbr[k.toUpperCase()] = IDX.byAbbr[k.toUpperCase()] || id;
    });
    return IDX;
  }

  HL.matchId = function (it) {
    if (!it) return null;
    if (it.id && HL.dictById[it.id]) return it.id;

    var raw = it.name || it.id || '';
    var n = norm(raw);
    var ix = index();

    var rawKey = String(raw).trim().toLowerCase().replace(/[\s\u3000]/g, '');

    /* 0. 黑名单：这些名字字面上像某个字典项，但不是同一项 */
    if (EXCLUDE.test(rawKey)) return null;

    /* 1. 别名表（原始串小写直接查，中文别名也能命中） */
    if (ALIAS[rawKey] && HL.dictById[ALIAS[rawKey]]) return ALIAS[rawKey];
    if (n && ALIAS[n] && HL.dictById[ALIAS[n]]) return ALIAS[n];

    /* 纯英文（ALT / TC / HDL-C）：norm 会把英文全剥掉，n 为空。
       这时不能直接放弃，按缩写查一次。 */
    if (!n) {
      var pure = String(raw).trim();
      if (/^[A-Za-z][A-Za-z0-9\-]{1,10}$/.test(pure)) {
        var h0 = ix.byAbbr[pure.toUpperCase()];
        if (h0 && h0 !== '__dup__') return h0;
      }
      return null;
    }

    /* 2. 归一化后完全相同 */
    if (ix.byName[n] && ix.byName[n] !== '__dup__') return ix.byName[n];

    /* 3. 英文缩写 */
    var a = abbr(raw);
    if (a && ix.byAbbr[a] && ix.byAbbr[a] !== '__dup__') return ix.byAbbr[a];
    if (/^[A-Za-z][A-Za-z0-9\-]{1,10}$/.test(String(raw).trim())) {
      var up = String(raw).trim().toUpperCase();
      if (ix.byAbbr[up] && ix.byAbbr[up] !== '__dup__') return ix.byAbbr[up];
    }

    /* 4. 包含匹配：短串至少占长串一半，且候选唯一才采用。
          「白蛋白」会同时命中「白蛋白」和「前白蛋白」，候选不唯一就放弃。 */
    if (n.length >= 3) {
      var hits = [];
      for (var i = 0; i < ix.list.length; i++) {
        var e = ix.list[i];
        if (!e.n || e.n.length < 3) continue;
        var shorter = Math.min(e.n.length, n.length);
        var longer = Math.max(e.n.length, n.length);
        if (shorter / longer < 0.5) continue;
        if (e.n.indexOf(n) >= 0 || n.indexOf(e.n) >= 0) hits.push(e);
      }
      if (hits.length === 1) return hits[0].id;
      if (hits.length > 1) {
        hits.sort(function (x, y) {
          return Math.abs(x.n.length - n.length) - Math.abs(y.n.length - n.length);
        });
        if (Math.abs(hits[0].n.length - n.length) === Math.abs(hits[1].n.length - n.length)) return null;
        return hits[0].id;
      }
    }

    /* 5. 编辑距离 1
       OCR 认错字几乎都是差一个字：氮/氨、氯/氨、蛇/蛋、精/糖、虾/蛋。
       但正确写法常常只存在于别名表里（字典标准名是「丙氨酸氨基转移酶」，
       而「谷丙转氨酶」只在 ALIAS 里），所以候选池必须同时包含
       字典名和别名，否则这层容错等于没用。

       短名（3–4 字）必须候选唯一才采用：「尿蛋白」「尿胆原」只差一个字，
       随便挑一个就是误配，而误配会把正常项标成异常，比漏掉更糟。 */
    if (n.length >= 3) {
      var best = null, bestD = 2, ties = 0;
      for (var k = 0; k < ix.list.length; k++) {
        var e2 = ix.list[k];
        if (!e2.n || Math.abs(e2.n.length - n.length) > 1) continue;
        var dd = dist(n, e2.n);
        if (dd < bestD) { bestD = dd; best = e2.id; ties = 1; }
        else if (dd === bestD && e2.id !== best) ties++;
      }
      var aKeys = Object.keys(ALIAS);
      for (var j = 0; j < aKeys.length; j++) {
        var an = norm(aKeys[j]);
        if (!an || Math.abs(an.length - n.length) > 1) continue;
        var dd2 = dist(n, an);
        if (dd2 < bestD) { bestD = dd2; best = ALIAS[aKeys[j]]; ties = 1; }
        else if (dd2 === bestD && ALIAS[aKeys[j]] !== best) ties++;
      }
      if (best && bestD === 1 && (n.length >= 5 || ties === 1)) return best;
    }

    return null;
  };

  HL.matchDebug = function (name) {
    var id = HL.matchId({ name: name });
    return { input: name, norm: norm(name), abbr: abbr(name), id: id, name2: id ? HL.dictById[id].name : null };
  };
})();
