// ==================================================
// INITIALIZATION
// ==================================================

// VARIABLES
let elements = [];
let filteredElements = [];
let selectedMediaData = null;
let ModalCurrentElement = -1;
let editingComment = null;
let searchTerm = '';

// CONSTANTS
const API_BASE_URL = 'http://127.0.0.1:5000';
const CATEGORIES = {
  ANIME: 'Anime',
  MANGA: 'Manga',
  BOOK: 'Book',
  SERIES: 'Series',
  MOVIE: 'Movie'
};

// DOM ELEMENTS
const searchBtn = document.getElementById('searchBtn');
const mediaSelection = document.getElementById('mediaSelection');
const selectedMedia = document.getElementById('selectedMedia');
const addBtn = document.getElementById('addBtn');
const MediaModal = document.getElementById('MediaModal');
const cancelBtn = document.getElementById('cancelBtn');
const addMediaForm = document.getElementById('addMediaForm');
const elementsGrid = document.getElementById('elementsGrid');
const searchBox = document.getElementById('searchBox');
const noElements = document.getElementById('noElements');
const mediaName = document.getElementById('mediaName');
const mediaCategory = document.getElementById('mediaCategory');
const mediaProgress = document.getElementById('mediaProgress');
const mediaScore = document.getElementById('mediaScore');
const mediaCompleted = document.getElementById('mediaCompleted');
const mediaDataStarted = document.getElementById('mediaDataStarted');
const submitBtn = document.getElementById('submitBtn');
const apiContent = document.getElementById('apiContent');

// Initialize date picker
document.addEventListener('DOMContentLoaded', function () {
  flatpickr("#mediaDataStarted", {
    defaultDate: "today",
    dateFormat: "d-m-Y",
  });
});

addBtn.addEventListener('click', openMediaModal);
cancelBtn.addEventListener('click', closeMediaModal);
submitBtn.addEventListener('click', addMedia);
searchBtn.addEventListener('click', () => searchMedia(false));
addMediaForm.addEventListener('submit', (e) => { e.preventDefault(); });
MediaModal.addEventListener('click', (e) => {
  if (e.target === MediaModal) closeMediaModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && MediaModal.classList.contains('active')) {
    closeMediaModal();
  }
});
mediaName.addEventListener('input', debounce(() => getAPIInfo(), 500));
mediaCategory.addEventListener('change', () => changeCategory());

// Initial data load
getMedias();

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function updateProgressLabel(category) {
  const labels = {
    [CATEGORIES.ANIME]: { progress: 'Episodes watched', total: 'Total episodes', info: 'Synopsis' },
    [CATEGORIES.MANGA]: { progress: 'Chapters read', total: 'Total chapters', info: 'Synopsis' },
    [CATEGORIES.BOOK]: { progress: 'Pages read', total: 'Total pages', info: 'About' },
    [CATEGORIES.SERIES]: { progress: 'Episodes watched', total: 'Total episodes', info: 'Synopsis' },
    [CATEGORIES.MOVIE]: { progress: 'Times watched', total: 'Duration (min)', info: 'Synopsis' }
  };

  const label = labels[category] || { progress: 'Progress', total: 'Total', info: 'Info' };
  return label;
}

function updateUserValuesLabel() {
  const label = updateProgressLabel(mediaCategory.value);
  document.getElementById("userValues").querySelector('label[for="mediaProgress"]').textContent = label.progress + ":";
}

function createFormData(obj) {
  const formData = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

function validateMediaInput(element) {
  if (!element.name || !element.category || !element.score) {
    return { valid: false, error: 'Please fill in all required fields' };
  }
  if (isNaN(element.progress)) {
    return { valid: false, error: 'Progress must be a number!' };
  }
  return { valid: true };
}

function handleAPIError(error, operation) {
  console.error(`Failed to ${operation}:`, error);
  alert(`Failed to ${operation}.`);
}

// ==================================================
// DISPLAY FUNCTIONS
// ==================================================

// MODAL 
function openMediaModal() {
  MediaModal.classList.remove('API');

  if (ModalCurrentElement != -1) { // Edit existing element
    submitBtn.innerText = "Update";
    submitBtn.removeEventListener('click', addMedia);
    submitBtn.addEventListener('click', updateElement);
    mediaName.value = elements[ModalCurrentElement].name;
    mediaProgress.value = elements[ModalCurrentElement].progress;
    mediaScore.value = elements[ModalCurrentElement].score;
    mediaDataStarted.value = elements[ModalCurrentElement].date;
    mediaCategory.value = elements[ModalCurrentElement].category;
    document.getElementById("userValues").hidden = false;

    selectedMediaData = {
      title: elements[ModalCurrentElement].name,
      external_id: elements[ModalCurrentElement].external_id,
      cover_image_url: elements[ModalCurrentElement].cover_image_url,
      total_episodes: elements[ModalCurrentElement].total_episodes,
      external_score: elements[ModalCurrentElement].external_score,
      synopsis: elements[ModalCurrentElement].synopsis,
    };

    mediaSelection.classList.add('hidden');
    selectedMedia.classList.remove('hidden');
    selectedMedia.innerHTML = '';
    document.getElementById("userValues").classList.remove('hidden');
    createResetSelectedMediaButton();
    selectedMedia.append(createAPIInfoBox(selectedMediaData, "selected"));
    updateUserValuesLabel();
  }
  else { // Add new element
    submitBtn.innerText = "Add";
    submitBtn.removeEventListener('click', updateElement);
    submitBtn.addEventListener('click', addMedia);
    mediaName.value = '';
    mediaProgress.value = "0";
    mediaScore.value = "7";

    document.getElementById("userValues").classList.add('hidden');
    selectedMedia.innerHTML = '';
    mediaSelection.classList.remove('hidden');
    selectedMedia.classList.add('hidden');
  }
  toggleAPIContent(false);
  MediaModal.classList.add('active');
  mediaName.focus();
}

function closeMediaModal() {
  ModalCurrentElement = -1;
  MediaModal.classList.remove('active');
  MediaModal.classList.remove('API');
}

// MEDIAS
function displayMedias(elementsToShow = elements) {
  elementsGrid.innerHTML = elementsToShow.length > 0 ? '' : '<div class="no-elements">No elements found.</div>';
  if (!elementsToShow.length > 0) return;
  elementsGrid.append(...elementsToShow.map(el => createCard(el)));
}

function createCard(el) {
  const card = Object.assign(document.createElement('div'), { className: 'element-card', id: `element-${el.id}` });

  // All info about the media
  const info = Object.assign(document.createElement('div'), { className: 'element-info' });
  const deleteBtn = Object.assign(document.createElement('button'), {
    className: 'deleteElement', textContent: '\u00D7',
    onclick: e => { removeElement(e, el.id), e.stopPropagation(); }
  });
  info.append(cardAPIInfo(el));

  const label = updateProgressLabel(el.category);
  const userValues = Object.assign(document.createElement('div'), { className: 'user-values' });
  userValues.append(
    Object.assign(document.createElement('div'), { className: 'element-status', innerHTML: `<span class="center">${el.complete == 1 ? 'Completed' : 'Incomplete'}</span> ` }),
    Object.assign(document.createElement('div'), { className: `element-category`, innerHTML: `<span class="left">Type:</span><span class="right">${el.category}</span> ` }),
    Object.assign(document.createElement('div'), { className: 'element-progress', innerHTML: `<span class="left">${label.progress}:</span><span class="right">${el.progress}</span>` }),
    Object.assign(document.createElement('div'), { className: 'element-score', innerHTML: `<span class="left">Score:</span><span class="right">${el.score}</span>` }),
    Object.assign(document.createElement('div'), { className: 'element-date', innerHTML: `<span class="left">Start Date:</span><span class="right">${el.date}</span>` }),
  );
  info.append(userValues);
  info.onclick = function () {
    ModalCurrentElement = elements.findIndex(element => el.id === element.id);
    openMediaModal();
  };

  // Area to add a new comment
  const addCommentArea = Object.assign(document.createElement('div'), { className: 'add-comment-section', id: `add-comment-section-${el.id}`, hidden: true });
  addCommentArea.append(
    Object.assign(document.createElement('textarea'), { id: `elementComment-${el.id}`, placeholder: 'Enter comment' }),
    Object.assign(document.createElement('button'), {
      className: 'commentBtn submitBtn',
      textContent: 'Submit',
      onclick: e => submitComment(el.id, e)
    })
  );
  const showAddCommentBtn = Object.assign(document.createElement('button'), {
    className: 'add-comment-btn', id: `add-comment-btn-${el.id}`, textContent: 'New',
    onclick: e => { toggleAddComment(addCommentArea, e); },
  });

  // Check if there are comments 
  const hasComments = el.comments && el.comments.length > 0;
  const commentContainer = Object.assign(document.createElement('div'), { className: 'comment-container', id: `comments-${el.id}` });
  const showCommentsBtn = hasComments ? Object.assign(document.createElement('button'), {
    className: 'toggle-comment-button', textContent: 'Hide Comments',
    onclick: e => toggleViewComment(commentContainer, e)
  }) : "";
  // Populate comments 
  if (hasComments) {
    el.comments.map(comment => {
      const singleComment = Object.assign(document.createElement('div'), { className: 'single-comment', onclick: e => editComment(e, comment) });
      singleComment.append(
        Object.assign(document.createElement('div'), {
          className: 'comment-content', id: `comment-content-${comment.id}`, textContent: comment.text,
        }),
      );
      // Area to edit a comment
      const commentEditArea = Object.assign(document.createElement('div'), { className: "comment-edit-area", id: `comment-edit-area-${comment.id}` });
      commentEditArea.append(
        Object.assign(document.createElement('textarea'), {
          textContent: comment.text, className: 'comment-edit-input', id: `comment-edit-${comment.id}`, style: 'display: none',
          onclick: e => e.stopPropagation()
        }),
        Object.assign(document.createElement('button'), {
          textContent: 'Save', className: 'commentBtn submitBtn', id: `submitBtn-${comment.id}`, style: 'display: none',
          onclick: e => saveEditComment(e, comment.id)
        }),
        Object.assign(document.createElement('button'), {
          textContent: 'Cancel', className: 'commentBtn cancel-btn', id: `cancel-btn-${comment.id}`, style: 'display: none',
          onclick: e => cancelEditComment(e, comment.id)
        }),
        Object.assign(document.createElement('button'), {
          textContent: 'Delete', className: 'commentBtn delete-btn', id: `delete-btn-${comment.id}`, style: 'display: none',
          onclick: e => { e.stopPropagation(); removeComment(e, comment.id); }
        })
      );
      singleComment.append(commentEditArea);
      commentContainer.append(singleComment);
    });
  }
  else {
    commentContainer.textContent = "No comments"

  }
  // Append all to the card
  const commentSection = Object.assign(document.createElement('div'), { className: 'comment-section', textContent: 'Comments: ' });
  commentSection.append(showAddCommentBtn, addCommentArea, showCommentsBtn);
  card.append(deleteBtn, info, commentSection, commentContainer);

  return card;
}

function cardAPIInfo(el) {
  let externalInfoDiv = null;

  const info = Object.assign(document.createElement('div'), { className: 'element-api' });
  info.append(Object.assign(document.createElement('div'), { className: 'element-name', textContent: el.name }));
  const orgInfo = Object.assign(document.createElement('div'), { className: 'element-api-data' });

  const coverImg = Object.assign(document.createElement('img'), {
    className: 'element-cover',
    src: el.cover_image_url || '',
    alt: 'Image Unavailable',
    loading: 'lazy',
  });
  orgInfo.append(coverImg);

  const label = updateProgressLabel(el.category);

  const hasExternalInfo = el.synopsis || el.external_score || el.total_episodes;
  if (hasExternalInfo) {
    externalInfoDiv = Object.assign(document.createElement('div'), { className: 'element-api-info', id: `element-api-info-${el.id}` });

    if (el.total_episodes) { externalInfoDiv.append(Object.assign(document.createElement('p'), { innerHTML: `<strong>${label.total || "Total"}:</strong> ${el.total_episodes}` })); }

    if (el.external_score) { externalInfoDiv.append(Object.assign(document.createElement('p'), { innerHTML: `<strong>Score:</strong> ${el.external_score}` })); }

    if (el.synopsis) { externalInfoDiv.append(Object.assign(document.createElement('p'), { innerHTML: `<strong>${label.info}:</strong> ${el.synopsis}` })); }
  }
  if (hasExternalInfo) orgInfo.append(externalInfoDiv);
  info.append(orgInfo);
  return info;
}

function createAPIInfoBox(el, index) {
  const label = updateProgressLabel(mediaCategory.value);

  if (el.category) {
    const label = updateProgressLabel(el.category);
  }
  const media = Object.assign(document.createElement('div'), {
    className: `external-info-box`, onclick: () => {
      mediaClick(media, el);
    }
  });

  const title = Object.assign(document.createElement('h3'), { className: 'external-info-title', innerHTML: el.title });
  const image = Object.assign(document.createElement('img'), { className: 'external-info-img', src: el.cover_image_url || '', alt: 'Image Unavailable', loading: 'lazy', });
  const texts = Object.assign(document.createElement('div'), { className: 'external-info-text' });
  texts.append(
    Object.assign(document.createElement('p'), { id: `previewTotal${index}`, innerHTML: `<strong>${label.total}</strong> <span>${el.total_episodes || "Unknow"} </span>` }),
    Object.assign(document.createElement('p'), { id: `previewScore${index}`, innerHTML: `<strong>Average Score:</strong> <span>${el.external_score || "Unknow"}</span>` }),
    Object.assign(document.createElement('p'), { id: `previewSynopsis${index}`, innerHTML: `<strong>${label.info}:</strong> <span>${el.synopsis || "Unknow"}</span>` }
    ));

  const info = Object.assign(document.createElement('div'), { className: 'external-info-info' });
  info.append(image, texts);
  media.append(title, info);
  return media;
}

function searchMedia(previousValue = false) {
  const currentSearchText = document.getElementById('current-search');
  if (elements.length === 0) {
    elementsGrid.innerHTML = '<div class="no-elements">Nothing here yet, add something!</div>';
    currentSearchText.textContent = '';
    searchTerm = '';
    return;
  }
  searchTerm = previousValue ? searchTerm : searchBox.value.toLowerCase().trim();
  if (searchTerm === '') {
    filteredElements = elements;
    currentSearchText.textContent = '';
  } else {
    filteredElements = elements.filter(element =>
      element.name.toLowerCase().includes(searchTerm)
    );
    currentSearchText.textContent = `Showing results for "${searchTerm}"`;
  }
  searchBox.value = "";
  displayMedias(filteredElements);
}

function updateElementDisplay(item) {
  const elementToUpdate = elements.find(el => el.id === item.id);
  if (elementToUpdate) {
    elementToUpdate.name = item.name;
    elementToUpdate.category = item.category;
    elementToUpdate.progress = item.progress;
    elementToUpdate.complete = item.complete;
    elementToUpdate.comments = item.comments;
    elementToUpdate.date = item.date;
    elementToUpdate.external_id = item.external_id;
    elementToUpdate.cover_image_url = item.cover_image_url;
    elementToUpdate.total_episodes = item.total_episodes;
    elementToUpdate.external_score = item.external_score;
    elementToUpdate.synopsis = item.synopsis;
    elementToUpdate.score = item.score;
  }
  const elementCard = document.getElementById(`element-${item.id}`);
  if (elementCard) {
    elementCard.replaceWith(createCard(item));
  }
}

// COMMENTS
function editComment(e, comment) {
  e.stopPropagation();

  if (editingComment) {
    cancelEditComment(e, editingComment.commentId);
  }

  const clickHandler = (e) => {
    if (!e.target.closest(`#comment-edit-area-${comment.id}`)) {
      cancelEditComment(e, editingComment.commentId);
    }
  };
  editingComment = { commentId: comment.id, text: comment.text, clickHandler: clickHandler };

  document.addEventListener('click', editingComment.clickHandler, true);

  document.getElementById(`comment-content-${comment.id}`).style.display = 'none';

  const textarea = document.getElementById(`comment-edit-${comment.id}`);
  textarea.style.display = 'block';
  textarea.focus();

  document.getElementById(`submitBtn-${comment.id}`).style.display = 'inline-block';
  document.getElementById(`cancel-btn-${comment.id}`).style.display = 'inline-block';
  document.getElementById(`delete-btn-${comment.id}`).style.display = 'inline-block';
}

function cancelEditComment(e, commentId) {
  e.stopPropagation();
  document.removeEventListener('click', editingComment.clickHandler, true);
  const textarea = document.getElementById(`comment-edit-${commentId}`);
  textarea.value = editingComment.text;
  exitCommentEdit(commentId);
}

function exitCommentEdit(commentId) {
  document.getElementById(`comment-content-${commentId}`).style.display = 'block';
  document.getElementById(`comment-edit-${commentId}`).style.display = 'none';
  document.getElementById(`submitBtn-${commentId}`).style.display = 'none';
  document.getElementById(`cancel-btn-${commentId}`).style.display = 'none';
  document.getElementById(`delete-btn-${commentId}`).style.display = 'none';

  editingComment = null;
}

function toggleViewComment(commentDiv, e) {
  e.stopPropagation();
  commentDiv.hidden = !commentDiv.hidden;
  e.target.textContent = commentDiv.hidden ? 'View Comments' : 'Hide Comments';
}

function toggleAddComment(commentDiv, e) {
  e.stopPropagation();
  commentDiv.hidden = !commentDiv.hidden;
  commentDiv.firstElementChild.value = '';
  if (!commentDiv.hidden) {
    commentDiv.clickHandler = (event) => {
      if (!event.target.closest(`#${commentDiv.id}`)) {
        toggleAddComment(commentDiv, event);
      }
    };
    document.addEventListener('click', commentDiv.clickHandler, true);
  }
  else if (commentDiv.clickHandler) {
    document.removeEventListener('click', commentDiv.clickHandler, true);
    commentDiv.clickHandler = null;
  }
}

// EXTERNAL API DISPLAY INTEGRATION
function showAPIInfo(info) {
  toggleAPIContent(false);
  if ([CATEGORIES.MOVIE, CATEGORIES.SERIES].includes(mediaCategory.value)) {
    apiContent.textContent = 'API info not available for Movies or Series yet.';
    toggleAPIContent(true);
    return;
  }
  if (info.length > 0) {
    info.forEach((result, index) => {
      apiContent.append(createAPIInfoBox(result, index));
      toggleAPIContent(true);
    });
  }
  else {
    apiContent.textContent = 'Nothing found.';
    toggleAPIContent(true);
  }
}

function toggleAPIContent(active) {
  if (active) {
    apiContent.classList.remove('hidden');
    MediaModal.classList.add('API');
  }
  else {
    apiContent.classList.add('hidden');
    MediaModal.classList.remove('API');
    apiContent.innerHTML = '';
  }
}

function changeCategory() {
  mediaName.value = '';
  mediaName.focus();
  toggleAPIContent(false);
}

function mediaClick(media, result) {
  selectedMediaData = {
    title: result.title,
    external_id: result.external_id,
    cover_image_url: result.cover_image_url,
    total_episodes: result.total_episodes,
    external_score: result.external_score,
    synopsis: result.synopsis,
  };

  mediaName.value = result.title;
  document.getElementById("userValues").classList.remove('hidden');
  document.getElementById("userValues").focus();
  const label = updateProgressLabel(mediaCategory.value);
  document.getElementById("userValues").querySelector('label[for="mediaProgress"]').textContent = label.progress + ":";

  mediaSelection.classList.add('hidden');
  selectedMedia.classList.remove('hidden');

  if (selectedMedia.innerHTML == "") {
    createResetSelectedMediaButton();
  }
  selectedMedia.append(media);
  media.onclick = null;

  toggleAPIContent(false);
}

function createResetSelectedMediaButton() {
  const deleteBtn = Object.assign(document.createElement('button'), {
    className: 'selected-media-remove-btn', textContent: '⟲',
    onclick: e => {
      e.stopPropagation();
      selectedMediaData = null;

      document.getElementById("userValues").classList.add('hidden');
      mediaSelection.classList.remove('hidden');
      mediaName.value = "";
      mediaName.focus();

      selectedMedia.innerHTML = '';
      selectedMedia.classList.add('hidden');
    }
  });
  selectedMedia.append(deleteBtn);
}


// ==================================================
// ARRAY UPDATES (CALLS TO DISPLAY FUNCTIONS)
// ==================================================

function insertElement(item) {
  if (elements.length === 0) {
    elementsGrid.innerHTML = '';
  }
  elements.push(item);
  elementsGrid.append(createCard(item));
  if (searchTerm) { searchMedia(true); }
}

function deleteElementDisplay(item) {
  const index = elements.findIndex(el => el.id === item.id);
  if (index != -1) {
    elements.splice(index, 1);
  }
  const elementCard = document.getElementById(`element-${item.id}`);
  if (elementCard) {
    elementCard.remove();
  }
  if (elements.length === 0) {
    elementsGrid.innerHTML = '<div class="no-elements">Nothing here yet, add something!</div>';
  }
  if (searchTerm) { searchMedia(true); }
}

function insertComment(comment) {
  const element = elements.find(el => el.id === comment.media_id);
  element.comments.push(comment);
  updateElementDisplay(element);
}

function updateCommentDisplay(comment) {
  const index = elements.findIndex(el => el.id === comment.media_id);
  if (index != -1) {
    elements[index].comments.forEach(c => {
      if (c.id == comment.id) {
        c.text = comment.text;
        updateElementDisplay(elements[index]);
        return;
      }
    });
  }
  exitCommentEdit(comment.id);
}

function deleteCommentDisplay(comment) {
  const index = elements.findIndex(el => el.id === comment.media_id);
  if (index != -1) {
    elements[index].comments = elements[index].comments.filter(c => c.id !== comment.id);
  }
  updateElementDisplay(elements[index]);
}


// ==================================================
// API (USER CALLS)
// ==================================================

// MEDIA
function addMedia(e) {
  e.preventDefault();

  const newElement = {
    name: mediaName.value,
    category: mediaCategory.value,
    progress: mediaProgress.value,
    complete: mediaCompleted.checked ? 1 : 0,
    date: mediaDataStarted.value,
    score: mediaScore.value,
    external_id: selectedMediaData?.external_id || null,
    cover_image_url: selectedMediaData?.cover_image_url || null,
    total_episodes: selectedMediaData?.total_episodes || null,
    external_score: selectedMediaData?.external_score || null,
    synopsis: selectedMediaData?.synopsis || null,
  };

  const validation = validateMediaInput(newElement);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  postMedia(newElement);
  closeMediaModal();
  selectedMediaData = null;
}

function updateElement(e) {
  e.preventDefault();

  const newElement = {
    id: elements[ModalCurrentElement].id,
    name: mediaName.value,
    category: mediaCategory.value,
    progress: mediaProgress.value,
    complete: mediaCompleted.checked ? 1 : 0,
    score: mediaScore.value,
    comments: elements[ModalCurrentElement].comments,
    date: mediaDataStarted.value,
    external_id: selectedMediaData.external_id,
    cover_image_url: selectedMediaData.cover_image_url,
    total_episodes: selectedMediaData.total_episodes,
    external_score: selectedMediaData.external_score,
    synopsis: selectedMediaData.synopsis,
  };

  const validation = validateMediaInput(newElement);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  patchMedia(newElement);
  closeMediaModal();
}

function removeElement(e, element) {
  e.stopPropagation();
  deleteMedia(element);
}

// COMMENT 
function submitComment(id, e) {
  e.stopPropagation();

  const commentInput = document.getElementById(`elementComment-${id}`);
  const comment = {
    media_id: id,
    text: String(commentInput.value.trim()),
  };
  toggleAddComment(e.target.parentElement, e);
  if (comment.text !== '') {
    postComment(comment);
  }
}

function saveEditComment(e, commentId) {
  e.stopPropagation();

  const textarea = document.getElementById(`comment-edit-${commentId}`);
  const newText = textarea.value.trim();

  if (!newText) {
    alert('Comment cannot be empty');
    return;
  }
  patchComment({ id: commentId, text: newText });
}

function removeComment(e, commentID) {
  cancelEditComment(e, commentID);
  deleteComment(commentID);
}

// EXTERNAL API
function getAPIInfo() {
  if (mediaName.value.length > 2 && selectedMedia.innerHTML == '') {
    searchExternalAPI({ query: mediaName.value, category: mediaCategory.value });
  }
  else {
    MediaModal.classList.remove('API');
    toggleAPIContent(false);
  }
}


// ==================================================
// API CALLS
// ==================================================

// MEDIA
async function getMedias() {
  try {
    let response = await fetch(`${API_BASE_URL}/medias`, {
      method: 'get',
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    let data = await response.json();
    if (data.medias.length > 0) {
      data.medias.forEach(item => { insertElement(item); });
    }
    else {
      elementsGrid.innerHTML = '<div class="no-elements">Nothing here yet, add something!</div>';
    }
  }
  catch (error) {
    handleAPIError(error, 'get medias');
  }
}

async function postMedia(item) {
  try {
    const formData = createFormData(item);

    let response = await fetch(`${API_BASE_URL}/media`, {
      method: 'post',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    let data = await response.json();
    insertElement(data);
  }
  catch (error) {
    handleAPIError(error, 'post media');
  }
}

async function patchMedia(item) {
  try {
    const formData = createFormData(item);

    let response = await fetch(`${API_BASE_URL}/media?id=` + item.id, {
      method: 'patch',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    updateElementDisplay(item);
  }
  catch (error) {
    handleAPIError(error, 'patch media');
  }
}

async function deleteMedia(item) {
  try {
    let response = await fetch(`${API_BASE_URL}/media?id=` + item, {
      method: 'delete'
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    let data = await response.json();
    deleteElementDisplay(data.media);
  }
  catch (error) {
    handleAPIError(error, 'delete media');
  }
}

// COMMENT
async function postComment(comment) {
  try {
    const formData = createFormData(comment);

    let response = await fetch(`${API_BASE_URL}/comment`, {
      method: 'post',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    let data = await response.json();
    insertComment(data.comment);
  }
  catch (error) {
    handleAPIError(error, 'post comment');
  }
}

async function patchComment(comment) {
  try {
    const formData = createFormData(comment);

    let response = await fetch(`${API_BASE_URL}/comment`, {
      method: 'patch',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    let data = await response.json();
    updateCommentDisplay(data);
  }
  catch (error) {
    handleAPIError(error, 'patch comment');
  }
}

async function deleteComment(id) {
  try {
    let response = await fetch(`${API_BASE_URL}/comment?id=${id}`, {
      method: 'delete',
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    let data = await response.json();
    deleteCommentDisplay(data.comment);
  }
  catch (error) {
    handleAPIError(error, 'delete comment');
  }
}

// EXTERNAL API
async function searchExternalAPI(item) {
  try {
    const formData = createFormData(item);

    let response = await fetch(`${API_BASE_URL}/search?query=${item.query}&category=${item.category}`, {
      method: 'get',
    });

    if (!response.ok) {
      throw new Error('Error:' + response.statusText);
    }

    let data = await response.json();
    showAPIInfo(data.results);
  }
  catch (error) {
    handleAPIError(error, 'search from external api');
  }
}