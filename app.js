const STORAGE_KEY = "study-hours-ledger-v1";
const THEME_KEY = "study-hours-theme";

const yuan = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const defaultState = {
  activeStudentId: "",
  students: [],
};

let state = normaliseState(loadState());
let editingLessonId = "";
const analysisRange = {
  from: "",
  to: "",
};

const elements = {
  studentForm: document.querySelector("#studentForm"),
  studentName: document.querySelector("#studentName"),
  studentCount: document.querySelector("#studentCount"),
  studentList: document.querySelector("#studentList"),
  helpOpen: document.querySelector("#helpOpen"),
  helpDialog: document.querySelector("#helpDialog"),
  helpClose: document.querySelector("#helpClose"),
  activeStudentTitle: document.querySelector("#activeStudentTitle"),
  themeMode: document.querySelector("#themeMode"),
  saveState: document.querySelector("#saveState"),
  overviewUsed: document.querySelector("#overviewUsed"),
  overviewRemaining: document.querySelector("#overviewRemaining"),
  overviewSessions: document.querySelector("#overviewSessions"),
  subjects: document.querySelector("#subjects"),
  totalHours: document.querySelector("#totalHours"),
  lessonUnits: document.querySelector("#lessonUnits"),
  nextClassTime: document.querySelector("#nextClassTime"),
  lessonForm: document.querySelector("#lessonForm"),
  lessonDate: document.querySelector("#lessonDate"),
  durationHours: document.querySelector("#durationHours"),
  durationMinutes: document.querySelector("#durationMinutes"),
  durationTotal: document.querySelector("#durationTotal"),
  lessonContent: document.querySelector("#lessonContent"),
  lessonStartTime: document.querySelector("#lessonStartTime"),
  convertedPreview: document.querySelector("#convertedPreview"),
  clearLessons: document.querySelector("#clearLessons"),
  filterDateFrom: document.querySelector("#filterDateFrom"),
  filterDateTo: document.querySelector("#filterDateTo"),
  resetDateFilter: document.querySelector("#resetDateFilter"),
  analysisStatus: document.querySelector("#analysisStatus"),
  lessonTable: document.querySelector("#lessonTable"),
  exportXlsx: document.querySelector("#exportXlsx"),
  exportCsv: document.querySelector("#exportCsv"),
  exportJson: document.querySelector("#exportJson"),
  importXlsx: document.querySelector("#importXlsx"),
  importJson: document.querySelector("#importJson"),
  importCsv: document.querySelector("#importCsv"),
  copySummary: document.querySelector("#copySummary"),
  summaryText: document.querySelector("#summaryText"),
  copyFeedback: document.querySelector("#copyFeedback"),
  feedbackText: document.querySelector("#feedbackText"),
  editLessonDialog: document.querySelector("#editLessonDialog"),
  editLessonForm: document.querySelector("#editLessonForm"),
  editLessonClose: document.querySelector("#editLessonClose"),
  editLessonCancel: document.querySelector("#editLessonCancel"),
  editLessonDate: document.querySelector("#editLessonDate"),
  editLessonStartTime: document.querySelector("#editLessonStartTime"),
  editDurationHours: document.querySelector("#editDurationHours"),
  editDurationMinutes: document.querySelector("#editDurationMinutes"),
  editLessonContent: document.querySelector("#editLessonContent"),
};

initialise();

function initialise() {
  if (!state.students.length) {
    const seededStudent = createStudent("张三");
    seededStudent.totalHours = 37;
    seededStudent.lessonUnits = 49.33;
    seededStudent.lessons = [
      createLesson("第一节", "2026-07-11", 92, "半章"),
      createLesson("第二节", "2026-07-12", 45, "半章"),
      createLesson("第三节", "2026-07-13", 130, "半章"),
    ];
    state.students.push(seededStudent);
    state.activeStudentId = seededStudent.id;
    saveState();
  }

  elements.lessonDate.value = todayISO();
  applyTheme(localStorage.getItem(THEME_KEY) || "parchment");
  bindEvents();
  render();
}

function bindEvents() {
  elements.studentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.studentName.value.trim();
    if (!name) return;
    const student = createStudent(name);
    state.students.push(student);
    state.activeStudentId = student.id;
    elements.studentName.value = "";
    commit();
  });

  [elements.subjects, elements.nextClassTime].forEach((input) => {
    input.addEventListener("input", () => {
      const student = getActiveStudent();
      if (!student) return;
      student.subjects = elements.subjects.value.trim();
      student.nextClassTime = elements.nextClassTime.value.trim();
      saveState();
      renderExports();
    });
  });

  elements.totalHours.addEventListener("input", () => {
    const student = getActiveStudent();
    const totalHours = readDecimalInput(elements.totalHours);
    if (!student || totalHours === null) return;
    student.totalHours = totalHours;
    student.lessonUnits = round2(totalHours / 0.75);
    elements.lessonUnits.value = student.lessonUnits;
    saveProfileMetrics();
  });

  elements.lessonUnits.addEventListener("input", () => {
    const student = getActiveStudent();
    const lessonUnits = readDecimalInput(elements.lessonUnits);
    if (!student || lessonUnits === null) return;
    student.lessonUnits = lessonUnits;
    student.totalHours = round2(lessonUnits * 0.75);
    elements.totalHours.value = student.totalHours;
    saveProfileMetrics();
  });

  elements.themeMode.addEventListener("change", () => {
    applyTheme(elements.themeMode.value);
    localStorage.setItem(THEME_KEY, elements.themeMode.value);
  });

  elements.durationHours.addEventListener("input", syncDurationTotal);
  elements.durationMinutes.addEventListener("input", syncDurationTotal);

  elements.lessonForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const student = getActiveStudent();
    if (!student) return;
    const minutes = getDurationMinutes();
    if (minutes <= 0) {
      flash("请输入有效课时时长");
      elements.durationHours.focus();
      return;
    }
    student.lessons.push(
      createLesson(
        `第${student.lessons.length + 1}节`,
        elements.lessonDate.value || todayISO(),
        Math.round(minutes),
        elements.lessonContent.value.trim() || "半章",
        elements.lessonStartTime.value,
      ),
    );
    elements.durationHours.value = "";
    elements.durationMinutes.value = "";
    elements.lessonStartTime.value = "";
    elements.lessonStartTime.closest("details").open = false;
    syncDurationTotal();
    commit();
  });

  [elements.filterDateFrom, elements.filterDateTo].forEach((input) => {
    input.addEventListener("change", () => {
      analysisRange.from = elements.filterDateFrom.value;
      analysisRange.to = elements.filterDateTo.value;
      if (analysisRange.from && analysisRange.to && analysisRange.from > analysisRange.to) {
        [analysisRange.from, analysisRange.to] = [analysisRange.to, analysisRange.from];
        elements.filterDateFrom.value = analysisRange.from;
        elements.filterDateTo.value = analysisRange.to;
        flash("已自动调整日期范围");
      }
      renderLessons();
      renderExports();
    });
  });

  elements.resetDateFilter.addEventListener("click", () => {
    analysisRange.from = "";
    analysisRange.to = "";
    elements.filterDateFrom.value = "";
    elements.filterDateTo.value = "";
    renderLessons();
    renderExports();
  });

  elements.clearLessons.addEventListener("click", () => {
    const student = getActiveStudent();
    if (!student) return;
    if (!confirm(`确认清空“${student.name}”的全部课时记录？此操作无法撤销。`)) return;
    student.lessons = [];
    commit();
  });

  elements.exportXlsx.addEventListener("click", exportXlsx);
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.exportJson.addEventListener("click", exportJson);
  elements.importXlsx.addEventListener("change", importXlsx);
  elements.importJson.addEventListener("change", importJson);
  elements.importCsv.addEventListener("change", importCsv);
  elements.copySummary.addEventListener("click", () => copyText(elements.summaryText.value));
  elements.copyFeedback.addEventListener("click", () => copyText(elements.feedbackText.value));
  elements.helpOpen.addEventListener("click", () => elements.helpDialog.showModal());
  elements.helpClose.addEventListener("click", () => elements.helpDialog.close());
  elements.helpDialog.addEventListener("click", (event) => {
    if (event.target === elements.helpDialog) elements.helpDialog.close();
  });
  elements.editLessonClose.addEventListener("click", closeLessonEditor);
  elements.editLessonCancel.addEventListener("click", closeLessonEditor);
  elements.editLessonDialog.addEventListener("click", (event) => {
    if (event.target === elements.editLessonDialog) closeLessonEditor();
  });
  elements.editLessonForm.addEventListener("submit", saveLessonEdit);
}

function render() {
  renderStudents();
  renderActiveStudent();
  renderLessons();
  renderExports();
}

function renderStudents() {
  elements.studentList.innerHTML = "";
  elements.studentCount.textContent = `${state.students.length} 人`;
  state.students.forEach((student) => {
    const used = getUsedHours(student);
    const progress = student.totalHours ? Math.min(100, (used / student.totalHours) * 100) : 0;
    const card = document.createElement("article");
    card.className = `student-card${student.id === state.activeStudentId ? " active" : ""}`;
    card.style.setProperty("--progress", `${progress}%`);
    card.innerHTML = `
      <div class="student-progress"></div>
      <div class="student-content">
        <button class="student-pick" type="button" aria-label="选择 ${escapeHtml(student.name)}" ${student.id === state.activeStudentId ? 'aria-current="true"' : ""}>
          <strong>${escapeHtml(student.name)}</strong>
          <small>${formatHours(used)} / ${formatHours(student.totalHours)} · 剩 ${formatHours(getRemainingHours(student))}</small>
        </button>
        <div class="student-actions">
          <button class="tiny-button rename" type="button" title="改名" aria-label="修改 ${escapeHtml(student.name)} 的姓名">✎</button>
          <button class="tiny-button delete danger" type="button" title="删除" aria-label="删除学员 ${escapeHtml(student.name)}">×</button>
        </div>
      </div>
    `;
    card.querySelector(".student-pick").addEventListener("click", () => {
      state.activeStudentId = student.id;
      commit();
    });
    card.querySelector(".rename").addEventListener("click", () => {
      const nextName = prompt("输入新姓名", student.name);
      if (!nextName?.trim()) return;
      student.name = nextName.trim();
      commit();
    });
    card.querySelector(".delete").addEventListener("click", () => {
      if (!confirm(`确认删除学员“${student.name}”及其全部课时？此操作无法撤销。`)) return;
      state.students = state.students.filter((item) => item.id !== student.id);
      state.activeStudentId = state.students[0]?.id || "";
      commit();
    });
    elements.studentList.appendChild(card);
  });

  if (!state.students.length) {
    elements.studentList.innerHTML = `<div class="empty-state">暂无学员。先新增一个。</div>`;
  }
}

function renderActiveStudent() {
  const student = getActiveStudent();
  const disabled = !student;
  [
    elements.subjects,
    elements.totalHours,
    elements.lessonUnits,
    elements.nextClassTime,
    elements.lessonDate,
    elements.durationHours,
    elements.durationMinutes,
    elements.lessonContent,
    elements.lessonStartTime,
    elements.filterDateFrom,
    elements.filterDateTo,
  ].forEach((input) => {
    input.disabled = disabled;
  });
  elements.lessonForm.querySelector("button[type='submit']").disabled = disabled;
  elements.clearLessons.disabled = disabled || !student?.lessons.length;
  elements.resetDateFilter.disabled = disabled || (!analysisRange.from && !analysisRange.to);
  elements.copySummary.disabled = disabled;
  elements.copyFeedback.disabled = disabled;

  if (!student) {
    elements.activeStudentTitle.textContent = "选择或新增学员";
    renderOverview(null);
    return;
  }

  renderOverview(student);
  elements.subjects.value = student.subjects;
  elements.totalHours.value = round2(student.totalHours);
  elements.lessonUnits.value = round2(student.lessonUnits);
  elements.nextClassTime.value = student.nextClassTime;
}

function renderOverview(student) {
  if (!student) {
    elements.overviewUsed.textContent = "0小时";
    elements.overviewRemaining.textContent = "0小时";
    elements.overviewSessions.textContent = "0 节";
    return;
  }
  elements.activeStudentTitle.textContent = `${student.name} · 剩余 ${formatHours(getRemainingHours(student))}`;
  elements.overviewUsed.textContent = formatHours(getUsedHours(student));
  elements.overviewRemaining.textContent = formatHours(getRemainingHours(student));
  elements.overviewSessions.textContent = `${student.lessons.length} 节`;
}

function saveProfileMetrics() {
  const student = getActiveStudent();
  if (!student) return;
  saveState();
  renderOverview(student);
  renderStudents();
  renderLessons();
  renderExports();
}

function renderLessons() {
  const student = getActiveStudent();
  elements.lessonTable.innerHTML = "";
  if (!student?.lessons.length) {
    elements.analysisStatus.textContent = "暂无记录";
    elements.lessonTable.innerHTML = `<tr><td colspan="7" class="empty-state">暂无课时记录</td></tr>`;
    return;
  }

  const sortedLessons = getSortedLessons(student);
  const filteredLessons = sortedLessons.filter(isLessonInAnalysisRange);
  const includedLessons = filteredLessons.filter((lesson) => !lesson.excluded);
  const lessonIndex = new Map(sortedLessons.map((lesson, index) => [lesson.id, index]));
  const remainingById = new Map();
  let usedMinutes = 0;
  sortedLessons.forEach((lesson) => {
    usedMinutes += lesson.minutes;
    remainingById.set(lesson.id, Math.max(0, student.totalHours - usedMinutes / 60));
  });

  elements.analysisStatus.textContent = `${formatAnalysisRange()} · 显示 ${filteredLessons.length} 条，计入 ${includedLessons.length} 条 / ${formatHours(sumLessonMinutes(includedLessons) / 60)}`;
  elements.resetDateFilter.disabled = !analysisRange.from && !analysisRange.to;

  if (!filteredLessons.length) {
    elements.lessonTable.innerHTML = `<tr><td colspan="7" class="empty-state">该时间段内暂无课时记录</td></tr>`;
    return;
  }

  filteredLessons.forEach((lesson) => {
    const index = lessonIndex.get(lesson.id) || 0;
    const row = document.createElement("tr");
    row.className = lesson.excluded ? "lesson-excluded" : "";
    row.innerHTML = `
      <td class="date-time-cell"><strong>${escapeHtml(lesson.date)}</strong><small>${lesson.startTime ? escapeHtml(lesson.startTime) : "按录入时间排序"}</small></td>
      <td>${escapeHtml(getLessonTitle(index))}</td>
      <td class="duration-cell"><strong>${formatHours(lesson.minutes / 60)}</strong><small>${lesson.minutes} 分钟</small></td>
      <td class="lesson-content" title="${escapeHtml(lesson.content)}">${escapeHtml(lesson.content)}</td>
      <td>${formatHours(remainingById.get(lesson.id) || 0)}</td>
      <td><button class="analysis-toggle" type="button" aria-pressed="${!lesson.excluded}" aria-label="${lesson.excluded ? "恢复计入" : "排除"}${escapeHtml(getLessonTitle(index))}的分析">${lesson.excluded ? "已排除" : "计入"}</button></td>
      <td><div class="row-actions"><button class="tiny-button edit-lesson" type="button" aria-label="修改${escapeHtml(getLessonTitle(index))}">✎</button><button class="tiny-button delete-lesson danger" type="button" aria-label="删除${escapeHtml(getLessonTitle(index))}">×</button></div></td>
    `;
    row.querySelector(".analysis-toggle").addEventListener("click", () => {
      lesson.excluded = !lesson.excluded;
      commit();
    });
    row.querySelector(".edit-lesson").addEventListener("click", () => openLessonEditor(lesson.id));
    row.querySelector(".delete-lesson").addEventListener("click", () => {
      if (!confirm(`确认删除${getLessonTitle(index)}？`)) return;
      student.lessons = student.lessons.filter((item) => item.id !== lesson.id);
      commit();
    });
    elements.lessonTable.appendChild(row);
  });
}

function openLessonEditor(lessonId) {
  const lesson = getActiveStudent()?.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;
  editingLessonId = lesson.id;
  elements.editLessonDate.value = lesson.date;
  elements.editLessonStartTime.value = lesson.startTime;
  elements.editDurationHours.value = Math.floor(lesson.minutes / 60) || "";
  elements.editDurationMinutes.value = lesson.minutes % 60 || "";
  elements.editLessonContent.value = lesson.content;
  elements.editLessonDialog.showModal();
}

function closeLessonEditor() {
  editingLessonId = "";
  elements.editLessonDialog.close();
}

function saveLessonEdit(event) {
  event.preventDefault();
  const lesson = getActiveStudent()?.lessons.find((item) => item.id === editingLessonId);
  if (!lesson) return;
  const minutes = getEditDurationMinutes();
  if (minutes <= 0) {
    flash("请输入有效课时时长");
    elements.editDurationHours.focus();
    return;
  }
  lesson.date = elements.editLessonDate.value || todayISO();
  lesson.startTime = elements.editLessonStartTime.value;
  lesson.minutes = minutes;
  lesson.content = elements.editLessonContent.value.trim() || "半章";
  closeLessonEditor();
  commit();
}

function getEditDurationMinutes() {
  const hours = Math.max(0, Math.floor(toNumber(elements.editDurationHours.value)));
  const minutes = Math.max(0, Math.min(59, Math.floor(toNumber(elements.editDurationMinutes.value))));
  if (elements.editDurationMinutes.value && Number(elements.editDurationMinutes.value) > 59) {
    elements.editDurationMinutes.value = 59;
  }
  return hours * 60 + minutes;
}

function renderExports() {
  const student = getActiveStudent();
  if (!student) {
    elements.summaryText.value = "";
    elements.feedbackText.value = "";
    return;
  }
  const analysisLessons = getAnalysisLessons(student);
  const total = formatHours(student.totalHours);
  const used = formatHours(sumLessonMinutes(analysisLessons) / 60);
  const remaining = formatHours(Math.max(0, student.totalHours - sumLessonMinutes(analysisLessons) / 60));
  const latest = analysisLessons.at(-1);
  const latestHours = latest ? formatHours(latest.minutes / 60) : "0小时";
  const lessonIndex = latest ? getSortedLessons(student).findIndex((lesson) => lesson.id === latest.id) : -1;
  const latestSchedule = latest ? `${latest.date}${latest.startTime ? ` ${latest.startTime}` : ""}` : "暂无计入分析的课时";

  elements.summaryText.value = `分析范围：${formatAnalysisRange()}；计入${analysisLessons.length}节课，共${used}。总时长${round2(student.lessonUnits)}节课，45mins/节，总共${total}；按当前分析剩余${remaining}。`;
  elements.feedbackText.value = `（总时长${round2(student.lessonUnits)}节课，45mins/节，总共${round2(student.totalHours)}h）
学情反馈模板：
1、时间：${formatToday()}
2、授课科目：${student.subjects || "综合能力、导论"}
3、授课形式：腾讯一对一
4、授课内容：${latest?.content || elements.lessonContent.value || "半章"}
5、课次：${latest ? `${latestHours} ${getLessonTitle(lessonIndex)}（${latestSchedule}）` : latestSchedule}
6、累计课时：${used}
7、剩余课时：${remaining}
8、下次上课时间：${student.nextClassTime || "明天晚上6.25"}
学生确认属实后回复“确认”`;
}

function syncDurationTotal() {
  const minutes = getDurationMinutes();
  const display = `${Math.round(minutes)} 分钟 / ${formatHours(minutes / 60)}`;
  elements.durationTotal.value = display;
  elements.convertedPreview.textContent = `总计：${display}`;
}

function getDurationMinutes() {
  const hours = Math.max(0, Math.floor(toNumber(elements.durationHours.value)));
  const minutes = Math.max(0, Math.min(59, Math.floor(toNumber(elements.durationMinutes.value))));
  if (elements.durationMinutes.value && Number(elements.durationMinutes.value) > 59) {
    elements.durationMinutes.value = 59;
  }
  return hours * 60 + minutes;
}

function createStudent(name) {
  return {
    id: createId(),
    name,
    subjects: "综合能力、导论",
    totalHours: 37,
    lessonUnits: 49.33,
    nextClassTime: "明天晚上6.25",
    lessons: [],
  };
}

function createLesson(title, date, minutes, content, startTime = "") {
  return {
    id: createId(),
    title,
    date,
    minutes,
    content,
    startTime: normaliseTime(startTime),
    excluded: false,
    createdAt: new Date().toISOString(),
  };
}

function getActiveStudent() {
  return state.students.find((student) => student.id === state.activeStudentId) || null;
}

function getUsedHours(student) {
  return sumLessonMinutes(student.lessons) / 60;
}

function getRemainingHours(student) {
  return Math.max(0, student.totalHours - getUsedHours(student));
}

function getLessonTitle(index) {
  return `第${index + 1}节`;
}

function getSortedLessons(student) {
  return [...student.lessons].sort((first, second) => {
    const dateOrder = first.date.localeCompare(second.date);
    if (dateOrder) return dateOrder;
    if (!first.startTime && !second.startTime) return first.createdAt.localeCompare(second.createdAt);
    const timeOrder = getLessonSortTime(first).localeCompare(getLessonSortTime(second));
    if (timeOrder) return timeOrder;
    return first.createdAt.localeCompare(second.createdAt);
  });
}

function getLessonSortTime(lesson) {
  if (lesson.startTime) return `${lesson.startTime}:00.000`;
  const createdAt = new Date(lesson.createdAt);
  if (Number.isNaN(createdAt.getTime())) return "23:59:59.999";
  return [createdAt.getHours(), createdAt.getMinutes(), createdAt.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function getAnalysisLessons(student) {
  return getSortedLessons(student).filter((lesson) => isLessonInAnalysisRange(lesson) && !lesson.excluded);
}

function isLessonInAnalysisRange(lesson) {
  if (analysisRange.from && lesson.date < analysisRange.from) return false;
  if (analysisRange.to && lesson.date > analysisRange.to) return false;
  return true;
}

function formatAnalysisRange() {
  if (analysisRange.from && analysisRange.to) return `${analysisRange.from} 至 ${analysisRange.to}`;
  if (analysisRange.from) return `${analysisRange.from} 起`;
  if (analysisRange.to) return `截至 ${analysisRange.to}`;
  return "全部时间";
}

function sumLessonMinutes(lessons) {
  return lessons.reduce((sum, lesson) => sum + toNumber(lesson.minutes), 0);
}

function exportCsv() {
  const rows = getTabularRows();
  return downloadFile("学时统计.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function getTabularRows() {
  const header = ["student", "totalHours", "lessonUnits", "subjects", "nextClassTime", "date", "startTime", "title", "minutes", "hours", "left", "content", "excluded", "createdAt"];
  const rows = [header];
  state.students.forEach((student) => {
    let usedMinutes = 0;
    if (!student.lessons.length) {
      rows.push([student.name, student.totalHours, student.lessonUnits, student.subjects, student.nextClassTime, "", "", "", "", "", student.totalHours, "", "", ""]);
    }
    getSortedLessons(student).forEach((lesson, lessonIndex) => {
      usedMinutes += lesson.minutes;
      rows.push([
        student.name,
        student.totalHours,
        student.lessonUnits,
        student.subjects,
        student.nextClassTime,
        lesson.date,
        lesson.startTime,
        getLessonTitle(lessonIndex),
        lesson.minutes,
        round2(lesson.minutes / 60),
        round2(Math.max(0, student.totalHours - usedMinutes / 60)),
        lesson.content,
        lesson.excluded ? "true" : "false",
        lesson.createdAt,
      ]);
    });
  });
  return rows;
}

function exportXlsx() {
  const files = createXlsxFiles(getTabularRows());
  const blob = new Blob([createZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return downloadBlob("学时统计.xlsx", blob);
}

function exportJson() {
  return downloadFile("学时统计.json", JSON.stringify(state, null, 2), "application/json");
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirmImport(event)) return;
  readFile(file).then((text) => {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported.students)) throw new Error("JSON 缺少 students");
    state = normaliseState(imported);
    commit();
    event.target.value = "";
  }).catch((error) => flash(`导入失败：${error.message}`));
}

function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirmImport(event)) return;
  readFile(file).then((text) => {
    importRows(parseCsv(text), file.name.replace(/\.csv$/i, ""));
    event.target.value = "";
  }).catch((error) => flash(`导入失败：${error.message}`));
}

function importXlsx(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirmImport(event)) return;
  readArrayBuffer(file).then((buffer) => readXlsxRows(buffer))
    .then((rows) => {
      importRows(rows, file.name.replace(/\.xlsx$/i, ""));
      event.target.value = "";
    })
    .catch((error) => flash(`导入失败：${error.message}`));
}

function confirmImport(event) {
  const accepted = confirm("导入会覆盖当前全部学员与课时数据。建议先导出 JSON 备份，是否继续？");
  if (!accepted) event.target.value = "";
  return accepted;
}

function importRows(rows, fallbackName) {
  if (!rows.length) throw new Error("表格为空");
  const header = rows[0].map((value) => String(value).trim());
  if (header.includes("student")) {
    importStandardRows(rows);
    return;
  }
  if (header.includes("H") && header.includes("M") && header.includes("min")) {
    importLegacyRows(rows, fallbackName);
    return;
  }
  throw new Error("表头不匹配");
}

function importStandardRows(rows) {
  const [header, ...records] = rows;
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  const students = new Map();
  records.forEach((record) => {
    const name = String(record[index.student] || "").trim();
    if (!name) return;
    if (!students.has(name)) {
      const student = createStudent(name);
      student.totalHours = toNumber(record[index.totalHours]) || 37;
      student.lessonUnits = toNumber(record[index.lessonUnits]) || round2(student.totalHours / 0.75);
      student.subjects = record[index.subjects] || "综合能力、导论";
      student.nextClassTime = record[index.nextClassTime] || "明天晚上6.25";
      students.set(name, student);
    }
    const student = students.get(name);
    const minutes = toNumber(record[index.minutes]);
    if (minutes > 0) {
      const lesson = createLesson(
        getLessonTitle(student.lessons.length),
        record[index.date] || todayISO(),
        minutes,
        record[index.content] || "半章",
        record[index.startTime] || "",
      );
      lesson.excluded = parseBoolean(record[index.excluded]);
      lesson.createdAt = normaliseCreatedAt(record[index.createdAt], lesson.createdAt);
      student.lessons.push(lesson);
    }
  });
  state.students = Array.from(students.values());
  state.activeStudentId = state.students[0]?.id || "";
  commit();
}

function importLegacyRows(rows, fallbackName) {
  const header = rows[0];
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  const student = createStudent(fallbackName || "导入学员");
  student.totalHours = toNumber(header[0]) || 37;
  student.lessonUnits = round2(student.totalHours / 0.75);
  rows.slice(1).forEach((record) => {
    const minutes = toNumber(record[index.min]) || (toNumber(record[index.H]) * 60 + toNumber(record[index.M]));
    if (minutes > 0) {
      student.lessons.push(createLesson(getLessonTitle(student.lessons.length), todayISO(), minutes, "半章"));
    }
  });
  state.students = [student];
  state.activeStudentId = student.id;
  commit();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function createXlsxFiles(rows) {
  return {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Study Ledger</Application></Properties>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>学时统计</dc:title><dcterms:created>${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="学时统计" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": createWorksheetXml(rows),
  };
}

function createWorksheetXml(rows) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
      if (typeof value === "number" && Number.isFinite(value)) {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value ?? "")}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const localHeader = zipLocalHeader(nameBytes, data.length, crc);
    localParts.push(localHeader, data);
    centralParts.push(zipCentralHeader(nameBytes, data.length, crc, offset));
    offset += localHeader.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEndRecord(Object.keys(files).length, centralSize, offset);
  return concatBytes([...localParts, ...centralParts, end]);
}

function zipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEndRecord(count, centralSize, centralOffset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

async function readXlsxRows(buffer) {
  const entries = await readZipEntries(new Uint8Array(buffer));
  const sheetXml = new TextDecoder().decode(entries["xl/worksheets/sheet1.xml"]);
  const sharedStringsXml = entries["xl/sharedStrings.xml"] ? new TextDecoder().decode(entries["xl/sharedStrings.xml"]) : "";
  return parseWorksheetRows(sheetXml, sharedStringsXml);
}

async function readZipEntries(bytes) {
  const decoder = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findZipEnd(view);
  const count = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const entries = {};

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("XLSX ZIP 目录损坏");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    entries[name] = await readZipEntry(bytes, localOffset, compressedSize, method);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipEntry(bytes, offset, compressedSize, method) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("XLSX ZIP 文件头损坏");
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);
  if (method === 0) return compressed;
  if (method === 8 && "DecompressionStream" in globalThis) {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error("浏览器不支持解压该 XLSX");
}

function findZipEnd(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("不是有效 XLSX 文件");
}

function parseWorksheetRows(sheetXml, sharedStringsXml) {
  const parser = new DOMParser();
  const sheet = parser.parseFromString(sheetXml, "application/xml");
  const sharedStrings = sharedStringsXml ? Array.from(parser.parseFromString(sharedStringsXml, "application/xml").querySelectorAll("si")).map((item) => item.textContent || "") : [];
  return Array.from(sheet.querySelectorAll("sheetData row")).map((row) => {
    const values = [];
    Array.from(row.querySelectorAll("c")).forEach((cell) => {
      const columnIndex = columnIndexFromRef(cell.getAttribute("r") || "A1");
      const type = cell.getAttribute("t");
      const raw = cell.querySelector("v")?.textContent || "";
      let value = raw;
      if (type === "s") value = sharedStrings[Number(raw)] || "";
      if (type === "inlineStr") value = cell.querySelector("is t")?.textContent || "";
      if (type !== "s" && type !== "inlineStr" && raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
      values[columnIndex] = value;
    });
    return values.map((value) => value ?? "");
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

function readArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function downloadFile(filename, content, type) {
  const blob = new Blob(["\ufeff", content], { type });
  return downloadBlob(filename, blob);
}

async function downloadBlob(filename, blob) {
  const file = typeof File === "function" ? new File([blob], filename, { type: blob.type }) : null;
  const mobileDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
  if (mobileDevice && file && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `导出 ${filename}`,
      });
      flash("已打开系统保存 / 分享面板");
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        flash("已取消导出");
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 30000);
  flash("文件已开始下载");
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => flash("已复制")).catch(() => copyTextFallback(text));
    return;
  }
  copyTextFallback(text);
}

function copyTextFallback(text) {
  const field = document.createElement("textarea");
  field.value = text;
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
  flash("已复制");
}

function commit() {
  saveState();
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  flash("已保存到本地缓存");
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function normaliseState(candidate) {
  const source = candidate && typeof candidate === "object" ? candidate : structuredClone(defaultState);
  const students = Array.isArray(source.students) ? source.students.map((student, studentIndex) => {
    const lessons = Array.isArray(student.lessons) ? student.lessons.map((lesson, lessonIndex) => ({
      id: lesson.id || createId(),
      title: lesson.title || getLessonTitle(lessonIndex),
      date: /^\d{4}-\d{2}-\d{2}$/.test(lesson.date || "") ? lesson.date : todayISO(),
      minutes: Math.max(0, Math.round(toNumber(lesson.minutes))),
      content: String(lesson.content || "半章"),
      startTime: normaliseTime(lesson.startTime),
      excluded: parseBoolean(lesson.excluded),
      createdAt: normaliseCreatedAt(lesson.createdAt, new Date(studentIndex * 100000 + lessonIndex).toISOString()),
    })).filter((lesson) => lesson.minutes > 0) : [];
    const parsedTotalHours = Number(student.totalHours);
    const totalHours = Number.isFinite(parsedTotalHours) ? Math.max(0, parsedTotalHours) : 37;
    const parsedLessonUnits = Number(student.lessonUnits);
    return {
      id: student.id || createId(),
      name: String(student.name || `学员${studentIndex + 1}`),
      subjects: String(student.subjects || "综合能力、导论"),
      totalHours,
      lessonUnits: Number.isFinite(parsedLessonUnits) ? Math.max(0, parsedLessonUnits) : round2(totalHours / 0.75),
      nextClassTime: String(student.nextClassTime || "明天晚上6.25"),
      lessons,
    };
  }) : [];
  const activeStudentId = students.some((student) => student.id === source.activeStudentId) ? source.activeStudentId : students[0]?.id || "";
  return { activeStudentId, students };
}

function normaliseTime(value) {
  const text = String(value || "");
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "";
}

function normaliseCreatedAt(value, fallback) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function parseBoolean(value) {
  return value === true || String(value).toLowerCase() === "true" || String(value) === "1";
}

function flash(message) {
  elements.saveState.textContent = message;
  window.clearTimeout(flash.timer);
  flash.timer = window.setTimeout(() => {
    elements.saveState.textContent = "本地缓存已启用";
  }, 1600);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeMode.value = theme;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatToday() {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readDecimalInput(input) {
  if (input.value === "") return null;
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatHours(value) {
  return `${yuan.format(round2(value))}小时`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function columnIndexFromRef(ref) {
  const letters = ref.match(/[A-Z]+/i)?.[0].toUpperCase() || "A";
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function crc32(bytes) {
  let crc = -1;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
