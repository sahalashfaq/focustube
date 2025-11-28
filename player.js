

let player;
let currentVideoId = null;
const API_KEY = 'AIzaSyCEA8AGZmi_NLXikLkhH_r2C9-u6MsuInI';
let currentPlaylistId = null;
let currentVideoIndex = -1; // Track current video position in the playlist
let currentPlaylistVideos = []; // Store current playlist videos
let currentVideoReaction = 'none'; // Track current video's reaction state

// Wait for API to load, then init player
function initYouTubePlayer() {
    if (typeof YT === 'undefined' || !YT.Player) {
        // Retry after 500ms if API not ready
        setTimeout(initYouTubePlayer, 500);
        return;
    }

    // Get dynamic height from container
    const container = document.getElementById('player');
    const height = container ? Math.max(390, window.innerHeight * 0.4) : 390;

    player = new YT.Player('player', {
        height: height.toString(),
        width: '100%',
        videoId: '', // Start empty
        host: 'https://www.youtube-nocookie.com', // FIX: Privacy host bypasses referrer issues
        playerVars: {
            controls: 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            iv_load_policy: 3, // No annotations
            fs: 1, // Fullscreen
            origin: window.location.origin, // FIX: Required for referrer
            widget_referrer: window.location.href, // FIX: 2025 param for Error 153
            referrerpolicy: 'strict-origin-when-cross-origin' // CRITICAL: Iframe referrer policy
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

// Call this on DOM load
document.addEventListener('DOMContentLoaded', function () {
    // Load API script if not already
    if (!window.onYouTubeIframeAPIReady) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    initYouTubePlayer(); // Start init
});



function onPlayerReady(event) {
    console.log('Player ready – Videos will now play on click');
    loadVideos(); // Your existing load
    setupNavigationButtons(); // Your existing setup
}
function onPlayerError(event) {
    console.error('YouTube Error:', event.data);
    let message = 'Video failed to load. ';
    switch (event.data) {
        case 2: message += 'Invalid video ID.'; break;
        case 5: message += 'HTML5 player error – try refreshing.'; break;
        case 100: message += 'Video not found or private.'; break;
        case 101:
        case 150:
        case 153:
            message += 'Configuration error (153) – video embedding restricted. Opening on YouTube...';
            // Fallback: Open in new tab after delay
            setTimeout(() => {
                window.open(`https://www.youtube.com/watch?v=${currentVideoId}`, '_blank');
                showToast('Opened video on YouTube for playback.', 'info');
            }, 500);
            break;
        default: message += 'Unknown error – check console.';
    }
    showToast(message, 'error');
}
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        const videoId = player.getVideoData().video_id;
        if (videoId) {
            updateAllLikeButtons(videoId); // Your existing
            addToRecentlyPlayed(videoId, false); // Your existing
        }
    }
    if (event.data === YT.PlayerState.ENDED && currentVideoId) {
        markAsComplete(currentVideoId); // Your existing
        addToRecentlyPlayed(currentVideoId, true); // Your existing
    }
}

function handleVideoInput() {
    const videoLink = document.getElementById('new-play-save-video-link').value.trim();
    const videoId = extractVideoID(videoLink);
    const playlistId = extractPlaylistID(videoLink);

    if (playlistId) {
        showPlaylistPopup(videoId, playlistId);
    } else if (videoId) {
        handleSingleVideo(videoId);
    } else {
        showToast('Please enter a valid YouTube URL', warning);
    }
}
// Your existing handleSingleVideo() & playAndSaveVideo() remain the same, but ensure they call this playVideo
function handleSingleVideo(videoId) {
    const videos = getSavedVideos();
    const existingVideo = videos.find(video => video.id === videoId);

    if (existingVideo) {
        playVideo(videoId); // Now fixed
    } else {
        fetchVideoDetails(videoId, (videoData) => {
            saveVideo(videoData);
            playVideo(videoId); // Now fixed
        });
    }
}
// FIXED playVideo() – Now retries if player not ready
function playVideo(videoId) {
    if (!videoId) {
        showToast('No video ID found!', 'error');
        return;
    }

    currentVideoId = videoId;

    if (!player || typeof player.loadVideoById !== 'function') {
        // Retry after 1 second if player not ready
        showToast('Player loading... Retrying in 1s', 'info');
        setTimeout(() => playVideo(videoId), 1000);
        return;
    }

    try {
        console.log('Loading video:', videoId);
        player.loadVideoById({
            videoId: videoId,
            startSeconds: 0,
            suggestedQuality: 'large' // Auto HD
        });

        // Scroll & update UI
        scrollToPlayer();
        updateAllLikeButtons(videoId); // Your existing

        showToast('Video playing!', 'success');
    } catch (error) {
        console.error('Play error:', error);
        showToast('Failed to play – check video URL.', 'error');
        // Fallback open
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
    currentVideoId = videoId;
    player.loadVideoById(videoId);

    if (notesPanelOpen) {
        loadSavedNotes(videoId);
        updateNotesBadge();
    }
    // Force immediate update
    setTimeout(updateNotesIndicatorsGlobally, 500);
}
// Save a video to localStorage
function saveVideo(videoData, category) {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const existingIndex = videos.findIndex(v => v.id === videoData.id);

    if (existingIndex >= 0) {
        videos[existingIndex] = {
            ...videos[existingIndex],
            ...videoData,
            category: category || videos[existingIndex].category
        };
    } else {
        videos.push({
            ...videoData,
            category: category || 'General'
        });
    }

    localStorage.setItem('videos', JSON.stringify(videos));
    loadVideos(); // Refresh display
}



function playAndSaveVideo(videoId) {
    if (!videoId) {
        showToast('Please enter a valid YouTube URL', warning);
        return;
    }

    // First save the video
    fetchVideoDetails(videoId, (videoData) => {
        saveVideo(videoData);
        // Then play it
        playVideo(videoId);
    });
}
// Initialize on page load
// Setup event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Play and save button
    document.getElementById('new-play-save-video-btn').addEventListener('click', function () {
        const videoLink = document.getElementById('new-play-save-video-link').value.trim();
        const videoId = extractVideoID(videoLink);

        if (videoId) {
            playAndSaveVideo(videoId);
        } else {
            showToast('Please enter a valid YouTube URL', warning);
        }
    });

    // Enter key in input field
    document.getElementById('new-play-save-video-link').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            const videoLink = this.value.trim();
            const videoId = extractVideoID(videoLink);

            if (videoId) {
                playAndSaveVideo(videoId);
            } else {
                showToast('Please enter a valid YouTube URL', warning);
            }
        }
    });
});

// Helper functions
function extractVideoID(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function extractPlaylistID(url) {
    if (!url) return null;
    const regExp = /[&?]list=([^&]+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
}



function scrollToPlayer() {
    const playerDiv = document.getElementById('player');
    playerDiv?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Remove the duplicate onYouTubeIframeAPIReady function


// Loader functions
function showLoader() {
    document.getElementById('progress-container').style.display = 'block';
    updateProgress(0);
}

function hideLoader() {
    document.getElementById('progress-container').style.display = 'none';
}

function updateProgress(percent) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    if (progressBar && progressText) {
        progressBar.style.width = percent + '%';
        progressText.textContent = percent + '%';
    }
}
// Event listener for existing input and button to save multiple URLs
document.getElementById('save-video-btn').addEventListener('click', () => {
    const videoLinks = document.getElementById('video-link').value.split(',').map(link => link.trim());
    videoLinks.forEach(videoLink => {
        const videoId = extractVideoID(videoLink);
        const playlistId = extractPlaylistID(videoLink);

        if (playlistId) {
            showPlaylistPopup(videoId, playlistId); // Show popup for playlist
        } else if (videoId) {
            fetchVideoDetails(videoId, saveVideo); // Save single video
        } else {
            showToast(`Invalid YouTube link: ${videoLink}`, warning);
        }
    });
});

// New input and button functionality for playing and saving a video
document.getElementById('new-play-save-video-btn').addEventListener('click', () => {
    const videoLink = document.getElementById('new-play-save-video-link').value.trim();
    const videoId = extractVideoID(videoLink);
    const playlistId = extractPlaylistID(videoLink);

    if (playlistId) {
        // Show popup for playlist options
        showPlaylistPopup(videoId, playlistId);
    } else if (videoId) {
        // Directly download and play the video
        fetchVideoDetails(videoId, saveVideo);
        playVideo(videoId);
    } else {
        showToast('Invalid YouTube link!', error);
    }
});

// Extract YouTube video ID
function extractVideoID(url) {
    const match = url.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

// Extract YouTube playlist ID
function extractPlaylistID(url) {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Setup event listeners
    document.getElementById('new-play-save-video-btn').addEventListener('click', handleVideoInput);

    document.getElementById('new-play-save-video-link').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleVideoInput();
        }
    });

    // Load any existing videos
    loadVideos();
});
// Show popup for playlist options
function showPlaylistPopup(videoId, playlistId) {
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>
                <span class="material-symbols-outlined">open_folder</span> Playlist Detected
                </h3>
                <span class="material-symbols-outlined close-popup" onclick="closePopup()">close</span>
            </div>
            <div class="popup-body">
                <p>Do you want to save the <strong>whole playlist</strong> or just this video?</p>
                <div class="popup-buttons">
                    <button class="btn save-playlist-btn" onclick="saveEntirePlaylist('${playlistId}')">
                        Save Entire Playlist
                    </button>
                    <button class="btn save-video-btn" onclick="saveSingleVideo('${videoId}')">
                        Save Single Video
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    document.body.style.overflow = 'hidden';
}

// Close popup
function closePopup() {
    const popup = document.querySelector('.popup-overlay');
    if (popup) popup.remove();
    document.body.style.overflow = 'auto';
}

// Fetch video details using YouTube API
function fetchVideoDetails(videoId, callback) {
    const apiKey = 'AIzaSyDn-yYcO6lGz_vEmELFoeapJURSkso8a0g'; // Replace with your API key
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
                const snippet = data.items[0].snippet;
                const videoData = {
                    id: videoId,
                    title: snippet.title || `Video ${videoId}`,
                    thumbnail: snippet.thumbnails?.medium?.url || '',
                    status: 'not-started'
                };
                callback(videoData);
            } else {
                showToast('Video not found!', error)
            }
        })
        .catch(() => showToast('Error fetching video details.', error));
}

async function saveEntirePlaylist(playlistId) {
    showLoader();
    let savedCount = 0;
    let errorCount = 0;
    let nextPageToken = '';
    const maxVideos = 200; // Safety limit
    let playlistTitle = "YouTube Playlist";

    try {
        // Get playlist title
        const playlistInfo = await fetch(
            `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${API_KEY}`
        ).then(res => res.json());

        if (playlistInfo.items?.[0]?.snippet?.title) {
            playlistTitle = playlistInfo.items[0].snippet.title;
        }
    } catch (error) {
        console.error('Failed to fetch playlist title:', error);
        // Continue without title if failed
    }

    do {
        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}&pageToken=${nextPageToken}`
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            // Process each video
            for (const item of data.items || []) {  // Handle empty items safely
                try {
                    if (item.snippet?.resourceId?.kind === 'youtube#video') {
                        const videoData = {
                            id: item.snippet.resourceId.videoId,
                            title: item.snippet.title,
                            thumbnail: item.snippet.thumbnails?.medium?.url || '',
                            playlistId: playlistId,
                            playlistTitle: playlistTitle,
                            status: 'not-started'
                        };
                        saveVideo(videoData);
                        savedCount++;
                    }
                } catch (e) {
                    errorCount++;
                    console.error(`Failed to save video: ${item.snippet?.title || 'Unknown'}`, e);
                }

                // Rate limit
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            nextPageToken = data.nextPageToken || '';
            // Update progress (estimate total if available)
            const estimatedTotal = data.pageInfo?.totalResults || maxVideos;
            updateProgress(Math.floor((savedCount / Math.min(estimatedTotal, maxVideos)) * 100));

        } catch (pageError) {
            errorCount += 50;  // Approximate errors for failed page
            console.error('Failed to fetch playlist page:', pageError);
            nextPageToken = '';  // Stop pagination on error
        }

    } while (nextPageToken && savedCount < maxVideos);

    hideLoader();
    let message = `Saved ${savedCount} videos from "${playlistTitle}"`;
    if (errorCount > 0) {
        message += ` (${errorCount} failed – check console for details)`;
        showToast(message, 'success');  // Warning for partial success
    } else {
        showToast(message, 'success');
    }
    loadVideos();  // Refresh UI
}

// Save a video to localStorage
function saveVideo(videoData, category) {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const existingIndex = videos.findIndex(v => v.id === videoData.id);

    if (existingIndex >= 0) {
        videos[existingIndex] = {
            ...videos[existingIndex],
            ...videoData,
            category: category || videos[existingIndex].category
        };
        // showToast(`Video ${videoData.title}Saved`, 'info');
    } else {
        videos.push({
            ...videoData,
            category: category || 'General'
        });
    }

    localStorage.setItem('videos', JSON.stringify(videos));
    filterVideos(); // Refresh display based on current filter
}

// Delete Video
function deleteVideo(videoId) {
    let videos = JSON.parse(localStorage.getItem('videos')) || [];
    const videoToDelete = videos.find(v => v.id === videoId);
    videos = videos.filter(video => video.id !== videoId);
    localStorage.setItem('videos', JSON.stringify(videos));
    showToast(`Video "${videoToDelete?.title || ''}" is Deleted`, 'info');
    loadVideos();
    filterVideos();

    // If the deleted video was currently playing, stop it
    if (currentVideoId === videoId) {
        if (player && player.stopVideo) {
            player.stopVideo();

            currentVideoId = null;
        }
    }
}
// Mark a video as complete (show green dot)
function markAsComplete(videoId) {
    let videos = JSON.parse(localStorage.getItem('videos')) || [];
    const video = videos.find(v => v.id === videoId);
    if (video) {
        video.status = 'completed';
        localStorage.setItem('videos', JSON.stringify(videos));
        loadVideos();
        showToast(`Video: \n (${videoId}) \n is Marked As Complete`, 'success')

    }
}

// Utility function to copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showToast(`Copied to ClipBoard \n ${text}`, 'success')
}

// Toggle visibility of "Delete All Videos" button
function toggleDeleteAllButton() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const deleteAllBtn = document.getElementById('delete-all-btn');
    deleteAllBtn.style.display = videos.length > 0 ? 'block' : 'none';
}

// Add event listener for "Delete All Videos" button
document.getElementById('delete-all-btn').addEventListener('click', () => {
    // Confirm with the user
    if (confirm('Are you sure you want to delete all saved videos?')) {
        localStorage.removeItem('videos');
        loadVideos();
        showToast('All videos deleted successfully!', 'success')
        showToast('Delete All button!', 'info')
    }
});

// Modify the loadVideos function to handle the case when there are no saved videos
// Initialize Swiper instances
const swiperInstances = [];

function loadVideos() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const container = document.getElementById('video-grid');
    container.innerHTML = '';

    if (videos.length === 0) {
        container.innerHTML = '<div class="no-videos"><p>No saved videos. Add some videos first!</p></div>';
        toggleDeleteAllButton();
        return;
    }

    // Clear existing Swiper instances
    swiperInstances.forEach(swiper => {
        if (swiper && typeof swiper.destroy === 'function') {
            swiper.destroy(true, true);
        }
    });
    swiperInstances.length = 0;

    // Group videos by playlist
    const playlists = {};
    const standaloneVideos = [];

    videos.forEach(video => {
        if (video.playlistId) {
            if (!playlists[video.playlistId]) {
                playlists[video.playlistId] = {
                    title: video.playlistTitle || 'Untitled Playlist',
                    videos: []
                };
            }
            playlists[video.playlistId].videos.push(video);
        } else {
            standaloneVideos.push(video);
        }
    });

    // Create playlist sliders
    Object.keys(playlists).forEach(playlistId => {
        const playlist = playlists[playlistId];

        const playlistSection = document.createElement('div');
        playlistSection.className = 'playlist-section';
        playlistSection.innerHTML = `
            <div class="playlist-header">
                <h3>
                    <span class="material-symbols-outlined">folder_open</span>
                    <p contenteditable="true" 
                       class="editable-playlist-title"
                       data-playlist-id="${playlistId}">${playlist.title}</p>
                </h3>
                <div class="main">
                    <div class="playlist-controls">
                        <button onclick="openPlaylistEdit('${playlistId}')">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                    <div class="slider-nav-container">
                        <div class="slider-nav">
                            <div class="swiper-button-prev swiper-button-prev-${playlistId}"></div>
                            <div class="swiper-button-next swiper-button-next-${playlistId}"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="swiper playlist-slider" id="slider-${playlistId}">
                <div class="swiper-wrapper" id="container-${playlistId}"></div>
            </div>
        `;
        container.appendChild(playlistSection);

        const sliderContainer = document.getElementById(`container-${playlistId}`);

        playlist.videos.forEach(video => {
            sliderContainer.appendChild(createVideoCard(video));
        });
        const titleElement = playlistSection.querySelector('.editable-playlist-title');
        titleElement.addEventListener('blur', function () {
            const newTitle = this.textContent;
            savePlaylistTitle(playlistId, newTitle);
        });
        // Initialize Swiper for this playlist
        // Initialize Swiper for this playlist
        // In loadVideos() function, replace the swiper initialization with:
        const swiper = new Swiper(`#slider-${playlistId}`, {
            slidesPerView: 'auto',
            spaceBetween: 15,
            navigation: {
                nextEl: playlistSection.querySelector('.swiper-button-next'),
                prevEl: playlistSection.querySelector('.swiper-button-prev'),
            },
            observer: true,
            observeParents: true,
            resistanceRatio: 0,
            breakpoints: {
                0: { slidesPerView: 5 },
                640: { slidesPerView: 5 },
                1024: { slidesPerView: 5 }
            }
        }
        );

        swiperInstances.push(swiper);
        startNotesIndicatorUpdates();  // ← ADD THIS LINE
    });
    // Button state management function
    function updateNavButtons(swiperInstance) {
        const nextButton = swiperInstance.navigation.nextEl;
        const prevButton = swiperInstance.navigation.prevEl;

        // Toggle disabled state based on position
        nextButton.classList.toggle('swiper-button-disabled', swiperInstance.isEnd);
        prevButton.classList.toggle('swiper-button-disabled', swiperInstance.isBeginning);

        // Update ARIA attributes
        nextButton.setAttribute('aria-disabled', swiperInstance.isEnd);
        prevButton.setAttribute('aria-disabled', swiperInstance.isBeginning);
    }

    // Create standalone videos grid
    if (standaloneVideos.length > 0) {
        const standaloneSection = document.createElement('div');
        standaloneSection.className = 'standalone-videos';

        standaloneSection.innerHTML = `
            <h3>Your Videos</h3>
            <div class="video-grid-container">
                ${standaloneVideos.map(video => createVideoCard(video).join(''))}
            </div>
        `;

        container.appendChild(standaloneSection);
    }
    // In loadVideos(), after creating all playlist sections:
    setTimeout(() => {
        swiperInstances.forEach(swiper => {
            swiper.update();
            swiper.navigation.update();
        });
    }, 300);
    toggleDeleteAllButton();
}
// Proper save function
function savePlaylistTitle(playlistId, newTitle) {
    let videos = JSON.parse(localStorage.getItem('videos')) || [];

    // Update all videos in this playlist
    videos = videos.map(video => {
        if (video.playlistId === playlistId) {
            return { ...video, playlistTitle: newTitle };
        }
        return video;
    });

    localStorage.setItem('videos', JSON.stringify(videos));
}
// Add to global variables
let currentEditingPlaylistId = null;

// Update the createVideoCard function to include playlist indicator
function createVideoCard(video) {
    const dotClass = video.status === 'completed' ? 'green-dot' : (video.status === 'not-started' ? 'gray-dot' : '');
    const isPlaylist = video.playlistId ? true : false;
    // GET NOTE COUNT
    const savedNotes = JSON.parse(localStorage.getItem('mixify_notes') || '{}');
    const noteCount = (savedNotes[video.id] || []).length;

    // ADD BADGE IF NOTES EXIST
    const notesBadge = noteCount > 0
        ? `<div class="notes-indicator">${noteCount}</div>`
        : '';
    const slideDiv = document.createElement('div');
    slideDiv.className = showSingleVideos ? 'single-video-item' : 'swiper-slide stored-video';
    slideDiv.innerHTML = `
        <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" />
        <div class="dot ${dotClass}"></div>
        ${notesBadge}
        <h3>${video.title}</h3>
        <div class="control-area">
            <button class="play-button" onclick="playVideo('${video.id}')">
                PLAY
                <span class="material-symbols-outlined">double_arrow</span>
            </button>
            <div class="reaction" onclick="toggleVideoReaction('${video.id}', 'like')">
            ${reaction === 'like' ?
            '<span class="material-symbols-outlined liked">thumb_up</span>' :
            '<span class="material-symbols-outlined">thumb_up</span>'}
             </div>
            <button class="settings-btn" onclick="toggleSettings(this)">
            <span class="material-symbols-outlined">settings</span>
            </button>
            <div class="settings-dropdown hidden">
                ${isPlaylist ? `<button class="set-btn"  onclick="openPlaylistEdit('${video.playlistId}')">Edit Playlist</button>` : ''}
                <button class="set-btn" onclick="deleteVideo('${video.id}')">Delete Video</button>
                <button class="set-btn" onclick="copyToClipboard('https://www.youtube.com/watch?v=${video.id}')">Copy Video URL</button>
                <button class="set-btn" onclick="copyToClipboard('${video.id}')">Copy Video ID</button>
                <button class="set-btn" onclick="markAsComplete('${video.id}')">Mark as Complete</button>
            </div>
        </div>
    `;

    return slideDiv;
}
// Enhance your player controls with ARIA attributes
function enhancePlayerAccessibility() {
    const player = document.getElementById('player');
    if (player) {
        player.setAttribute('aria-label', 'YouTube video player');
        player.setAttribute('aria-role', 'application');

        const controls = document.querySelectorAll('.player-controls button');
        controls.forEach(control => {
            control.setAttribute('aria-label', `${control.textContent.trim()} video`);
        });
    }
}

// Lazy load non-critical elements
document.addEventListener('DOMContentLoaded', function () {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const video = entry.target;
                // Load your video content here
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.video-thumbnail').forEach(el => {
        observer.observe(el);
    });
});
function initSocialSharing(videoData) {
    const shareButtons = document.createElement('div');
    shareButtons.className = 'social-share';
    shareButtons.innerHTML = `
    <button class="share-twitter" aria-label="Share on Twitter">
      <span class="icon-twitter"></span>
    </button>
    <button class="share-facebook" aria-label="Share on Facebook">
      <span class="icon-facebook"></span>
    </button>
  `;

    document.querySelector('.player-container').appendChild(shareButtons);

    // Add event listeners for sharing
    document.querySelector('.share-twitter').addEventListener('click', () => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Watch "${videoData.title}" on Mixify`)}&url=${encodeURIComponent(window.location.href)}`;
        window.open(url, '_blank');
    });
}
// Update the modal toggle functions

function closePlaylistEdit() {
    const modal = document.getElementById('playlist-edit-modal');
    modal.classList.remove('active');
    currentEditingPlaylistId = null;
}

// Update remove function to prevent event bubbling
function removeFromPlaylist(videoId, event) {
    if (event) event.stopPropagation();

    let videos = JSON.parse(localStorage.getItem('videos')) || [];
    videos = videos.filter(v => v.id !== videoId);
    localStorage.setItem('videos', JSON.stringify(videos));

    // Refresh the edit view
    openPlaylistEdit(currentEditingPlaylistId);
}

// Add save playlist changes function
function savePlaylistChanges() {
    // In this case, changes are saved immediately when made
    // so we just close the modal
    closePlaylistEdit();
    loadVideos(); // Refresh the main view
}

// Add confirmation for playlist deletion
function confirmDeletePlaylist() {
    if (confirm('Are you absolutely sure you want to delete this entire playlist? All videos in the playlist will be removed.')) {
        let videos = JSON.parse(localStorage.getItem('videos')) || [];
        videos = videos.filter(v => v.playlistId !== currentEditingPlaylistId);
        localStorage.setItem('videos', JSON.stringify(videos));
        closePlaylistEdit();
        loadVideos();
    }
}

// Add to DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function () {
    // Modal event listeners
    document.querySelector('.close-edit-modal').addEventListener('click', closePlaylistEdit);
    document.getElementById('cancel-playlist-edit').addEventListener('click', closePlaylistEdit);
    document.getElementById('save-playlist-changes').addEventListener('click', savePlaylistChanges);
    document.getElementById('delete-playlist-btn').addEventListener('click', confirmDeletePlaylist);

    // Close modal when clicking outside content
    document.addEventListener('click', function (e) {
        if (e.target.closest('#delete-playlist-btn')) {
            confirmDeletePlaylist();
        }
    });
});
// Add this near the top of your code
window.confirmDeletePlaylist = function () {
    if (confirm('Are you absolutely sure you want to delete this entire playlist? All videos in the playlist will be removed.')) {
        let videos = JSON.parse(localStorage.getItem('videos')) || [];
        videos = videos.filter(v => v.playlistId !== currentEditingPlaylistId);
        localStorage.setItem('videos', JSON.stringify(videos));
        closePlaylistEdit();
        loadVideos();
    }
};
function createVideoItem(video) {
    const statusClass = video.status === 'completed' ? 'completed' : 'not-started';

    return `
        <div class="video-item">
            <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
            <div class="video-info">
                <div class="video-status">
                    <h3>${video.title}</h3>
                    <div class="status-dot ${statusClass}"></div>
                </div>
                <div class="video-actions">
                    <button class="play-btn" onclick="playVideo('${video.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="#ffffff">
                            <path d="M320-200v-560l440 280-440 280Z"/>
                        </svg>
                        Play
                    </button>
                    <div class="settings-container">
                        <button class="settings-btn" onclick="toggleSettings(this.parentElement)">
                            <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="#ffffff">
                                <path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/>
                            </svg>
                        </button>
                        <div class="settings-dropdown">
                            <button onclick="deleteVideo('${video.id}')">Delete</button>
                            <button onclick="copyToClipboard('https://www.youtube.com/watch?v=${video.id}')">Copy URL</button>
                            <button onclick="markAsComplete('${video.id}')">Mark as Complete</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function toggleSettings(container) {
    container.classList.toggle('show');
}

// Close settings dropdown when clicking elsewhere
document.addEventListener('click', function (e) {
    if (!e.target.closest('.settings-container')) {
        document.querySelectorAll('.settings-container').forEach(el => {
            el.classList.remove('show');
        });
    }
});

// Scroll to video player when playing
function scrollToPlayer() {
    const playerDiv = document.getElementById('player');
    if (playerDiv) {
        playerDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    showToast(`Video is playing`, 'success')
}

// Play video in YouTube player
function playVideo(videoId) {
    if (player && player.loadVideoById) {
        player.loadVideoById(videoId);
        currentVideoId = videoId; // Track the currently playing video ID
        scrollToPlayer(); // Scroll to the player when a video is played
    }
}

// Show/hide video settings dropdown
function toggleSettings(button) {
    const dropdown = button.nextElementSibling;
    dropdown.classList.toggle('hidden');
}
// Handle player state changes
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING && currentVideoId) {
        addToRecentlyPlayed(currentVideoId, false);
        updateAllLikeButtons(currentVideoId);
    }
    else if (event.data === YT.PlayerState.ENDED && currentVideoId) {
        markAsComplete(currentVideoId);
        addToRecentlyPlayed(currentVideoId, true);
    }

    // Handle auto-play if enabled
    if (event.data === YT.PlayerState.ENDED && autoPlayNext) {
        playNextVideo();
    }

    trackPlaybackHistory();
}

// Add or update a video in recently played
// Fix addToRecentlyPlayed function
function addToRecentlyPlayed(videoId, isCompleted) {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    let recentVideos = JSON.parse(localStorage.getItem('recentlyPlayed')) || [];

    // Remove if already exists
    recentVideos = recentVideos.filter(v => v.id !== videoId);

    // Add to beginning of array
    recentVideos.unshift({
        id: videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        timestamp: new Date().getTime(),
        completed: isCompleted
    });

    // Keep only the last 20 videos
    if (recentVideos.length > 20) {
        recentVideos = recentVideos.slice(0, 20);
    }

    localStorage.setItem('recentlyPlayed', JSON.stringify(recentVideos));
    loadRecentlyPlayed(); // Refresh the display
}

// Update loadRecentlyPlayed to ensure it shows newest first
function loadRecentlyPlayed() {
    const recentVideos = JSON.parse(localStorage.getItem('recentlyPlayed')) || [];
    const container = document.getElementById('recently-played-grid');
    container.innerHTML = '';

    if (recentVideos.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--p-color)">No recently played videos yet</p>';
        return;
    }

    // Sort by timestamp (newest first)
    recentVideos.sort((a, b) => b.timestamp - a.timestamp);

    recentVideos.forEach(video => {
        const videoDiv = document.createElement('div');
        videoDiv.className = 'recently-played-video';
        videoDiv.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" />
            ${video.completed ? '<span class="watched-badge">Watched</span>' : ''}
            <h3>${video.title}</h3>
            <button class="play-button" onclick="playVideo('${video.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="#e8eaed">
                    <path d="m480-320 160-160-160-160-56 56 64 64H320v80h168l-64 64 56 56Zm0 240q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                </svg>
            </button>
        `;
        container.appendChild(videoDiv);
    });
    startNotesIndicatorUpdates();
}

// Clear recently played history
function clearRecentlyPlayed() {
    if (confirm('Are you sure you want to clear your recently played history?')) {
        localStorage.removeItem('recentlyPlayed');
        loadRecentlyPlayed();
    }
}
// Update your existing playVideo function
function playVideo(videoId) {
    if (player && player.loadVideoById) {
        player.loadVideoById(videoId);
        currentVideoId = videoId;
        scrollToPlayer();
    }
}
document.addEventListener('DOMContentLoaded', function () {
    loadRecentlyPlayed();
});
// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    loadVideos();
    loadRecentlyPlayed(); // This line is already there but let's ensure it's working

    // Add this to ensure the recently played section is visible
    const recentVideos = JSON.parse(localStorage.getItem('recentlyPlayed')) || [];
    if (recentVideos.length > 0) {
        document.getElementById('recently-played-grid').style.display = 'grid';
    }
});
// Load saved videos on page load
document.addEventListener('DOMContentLoaded', loadVideos);
// Add these functions to handle navigation
function getCurrentVideoIndex() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    return videos.findIndex(v => v.id === currentVideoId);
}
function markCurrentVideoComplete() {
    if (!currentVideoId) return;

    markAsComplete(currentVideoId);
    // Update UI immediately
    document.getElementById('mark-complete-btn').disabled = true;
    // Optional: Change button appearance
    document.getElementById('mark-complete-btn').innerHTML = `
        <span class="material-symbols-outlined">Done</span>
    `;
}

function deleteCurrentVideo() {
    if (!currentVideoId) return;
    deleteVideo(currentVideoId);
    // After deletion, play next video if available
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const currentIndex = videos.findIndex(v => v.id === currentVideoId);

    if (videos.length > 0 && currentIndex < videos.length) {
        // Play next video or previous if at end
        const nextVideo = videos[currentIndex] || videos[currentIndex - 1];
        if (nextVideo) {
            playVideo(nextVideo.id);
        }
    } else {
        // No more videos
        currentVideoId = null;
        if (player && player.stopVideo) {
            player.stopVideo();
        }
    }

    updateNavigationButtons();
    filterVideos();
    showToast('Video Deleted!', 'success')
}
function playNextVideo() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const currentIndex = getCurrentVideoIndex();

    if (currentIndex < videos.length - 1) {
        const nextVideo = videos[currentIndex + 1];
        playVideo(nextVideo.id);
    } else {
        // Optionally loop to first video
        // playVideo(videos[0].id);
    }
}

function playPreviousVideo() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const currentIndex = getCurrentVideoIndex();

    if (currentIndex > 0) {
        const prevVideo = videos[currentIndex - 1];
        playVideo(prevVideo.id);
    } else {
        // Optionally loop to last video
        // playVideo(videos[videos.length - 1].id);
    }
}

// Update navigation buttons state
// Update the updateNavigationButtons function
function updateNavigationButtons() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const currentIndex = getCurrentVideoIndex();
    const currentVideo = videos.find(v => v.id === currentVideoId);

    // Navigation buttons
    document.getElementById('prev-video-btn').disabled = currentIndex <= 0;
    document.getElementById('next-video-btn').disabled = currentIndex >= videos.length - 1 || videos.length === 0;

    // Action buttons
    document.getElementById('mark-complete-btn').disabled = !currentVideoId || currentVideo?.status === 'completed';
    document.getElementById('delete-video-btn').disabled = !currentVideoId;

    // Update mark complete button text
    if (currentVideo?.status === 'completed') {
        document.getElementById('mark-complete-btn').innerHTML = `
            <span class="material-symbols-outlined">done</span>
        `;
    } else {
        document.getElementById('mark-complete-btn').innerHTML = `
            <span class="material-symbols-outlined">check_circle</span>
        `;
    }
}

// Add event listeners in DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    // Existing listeners...
    document.getElementById('prev-video-btn').addEventListener('click', playPreviousVideo);
    document.getElementById('next-video-btn').addEventListener('click', playNextVideo);

    // New listeners
    document.getElementById('mark-complete-btn').addEventListener('click', markCurrentVideoComplete);
    document.getElementById('delete-video-btn').addEventListener('click', deleteCurrentVideo);

    // Update the playVideo wrapper to handle button states
    const originalPlayVideo = window.playVideo;
    window.playVideo = function (videoId) {
        originalPlayVideo(videoId);
        updateNavigationButtons();
    };

    // Initial update
    updateNavigationButtons();
});

// Add these functions for playlist navigation
function playNextInPlaylist() {
    if (!currentPlaylistId) return;

    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const playlistVideos = videos.filter(v => v.playlistId === currentPlaylistId);
    const currentIndex = playlistVideos.findIndex(v => v.id === currentVideoId);

    if (currentIndex < playlistVideos.length - 1) {
        playVideo(playlistVideos[currentIndex + 1].id);
    }
}

function playPreviousInPlaylist() {
    if (!currentPlaylistId) return;

    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const playlistVideos = videos.filter(v => v.playlistId === currentPlaylistId);
    const currentIndex = playlistVideos.findIndex(v => v.id === currentVideoId);

    if (currentIndex > 0) {
        playVideo(playlistVideos[currentIndex - 1].id);
    }
}

// Update the playVideo function to track playlist context
const originalPlayVideo = window.playVideo;
window.playVideo = function (videoId) {
    originalPlayVideo(videoId);

    // Track if this video is part of a playlist
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const video = videos.find(v => v.id === videoId);
    currentPlaylistId = video?.playlistId || null;

    updateNavigationButtons();
};

// Add this near the top with other global variables
let mergePlaylistModal = null;

// Add this after the existing playlist edit functions
function showMergePlaylistDialog() {
    if (!currentEditingPlaylistId) return;

    // Create merge dialog
    mergePlaylistModal = document.createElement('div');
    mergePlaylistModal.className = 'popup-overlay';
    mergePlaylistModal.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>Merge Playlist</h3>
                <span class="material-symbols-outlined close-popup" onclick="closeMergeDialog()">close</span>
            </div>
            <div class="popup-body">
                <p>Select a playlist to merge <strong>#${getPlaylistTitle(currentEditingPlaylistId)}</strong></p>
                <div id="available-playlists" style="max-height: 300px; overflow-y: auto; margin-top: 20px;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(mergePlaylistModal);
    document.body.style.overflow = 'hidden';

    // Load available playlists (excluding the current one)
    loadAvailablePlaylists();
}

function closeMergeDialog() {
    if (mergePlaylistModal) {
        mergePlaylistModal.remove();
        mergePlaylistModal = null;
    }
    document.body.style.overflow = 'auto';
}

function loadAvailablePlaylists() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const playlists = {};

    // Group videos by playlist
    videos.forEach(video => {
        if (video.playlistId && video.playlistId !== currentEditingPlaylistId) {
            if (!playlists[video.playlistId]) {
                playlists[video.playlistId] = {
                    title: video.playlistTitle || 'Untitled Playlist',
                    count: 0
                };
            }
            playlists[video.playlistId].count++;
        }
    });

    const container = document.getElementById('available-playlists');
    container.innerHTML = '';

    if (Object.keys(playlists).length === 0) {
        container.innerHTML = '<p>No other playlists available to merge with.</p>';
        return;
    }

    Object.keys(playlists).forEach(playlistId => {
        const playlist = playlists[playlistId];
        const playlistItem = document.createElement('div');
        playlistItem.className = 'playlist-item';
        playlistItem.innerHTML = `
            <span><p>${playlist.title}</p> <strong>(${playlist.count} videos)</strong></span>
            <span class="material-symbols-outlined">chevron_right</span>
        `;

        playlistItem.addEventListener('click', () => {
            if (confirm(`Merge "${getPlaylistTitle(currentEditingPlaylistId)}" (${videos.filter(v => v.playlistId === currentEditingPlaylistId).length} videos) into "${playlist.title}"?`)) {
                mergePlaylists(currentEditingPlaylistId, playlistId);
                closeMergeDialog();
                closePlaylistEdit();
            }
        });

        container.appendChild(playlistItem);
    });
    // After loadVideos(), renderHistory(), renderPlaylist(), etc.
    startNotesIndicatorUpdates();  // ← ADD THIS LINE
}

function getPlaylistTitle(playlistId) {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const playlistVideo = videos.find(v => v.playlistId === playlistId);
    return playlistVideo?.playlistTitle || 'Untitled Playlist';
}

// Add event listener for the merge button
document.getElementById('merge-playlist-btn').addEventListener('click', showMergePlaylistDialog);


// Add this near the top with other global variables
const MERGED_PLAYLIST_PREFIX = "merged_";

// Update the openPlaylistEdit function to check if playlist is merged
function openPlaylistEdit(playlistId) {
    currentEditingPlaylistId = playlistId;
    const modal = document.getElementById('playlist-edit-modal');
    modal.classList.add('active');

    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const playlistVideos = videos.filter(v => v.playlistId === playlistId);
    const playlistTitle = playlistVideos[0]?.playlistTitle || 'Untitled Playlist';

    document.getElementById('playlist-edit-title').textContent = `${playlistTitle}`;

    // Check if this is a merged playlist and enable/disable unmerge button
    const unmergeBtn = document.getElementById('unmerge-playlist-btn');
    unmergeBtn.disabled = !playlistId.startsWith(MERGED_PLAYLIST_PREFIX);

    const videoList = document.getElementById('playlist-video-list');
    videoList.innerHTML = '';
    const shareBtn = document.getElementById('share-playlist-btn');
    shareBtn.onclick = () => sharePlaylist(playlistId, playlistTitle, playlistVideos);
    if (playlistVideos.length === 0) {
        videoList.innerHTML = '<p>No videos in this playlist</p>';
        return;
    }

    playlistVideos.forEach(video => {
        const item = document.createElement('div');
        item.className = 'playlist-video-item';
        item.innerHTML = `
            <span>${video.title}</span>
            <button onclick="removeFromPlaylist('${video.id}', event)">
                <span class="material-symbols-outlined">remove</span>
            </button>
        `;
        videoList.appendChild(item);
    });
}

// Add this function to handle unmerging
function unmergePlaylist() {
    if (!currentEditingPlaylistId) return;

    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const playlistVideos = videos.filter(v => v.playlistId === currentEditingPlaylistId);

    if (playlistVideos.length === 0) {
        showToast('This playlist is empty!', error);
        return;
    }

    if (confirm(`This will split the merged playlist back into its original playlists. Continue?`)) {
        // Group videos by their original playlist (stored in video.originalPlaylistId)
        const playlistsToRestore = {};

        playlistVideos.forEach(video => {
            if (video.originalPlaylistId) {
                if (!playlistsToRestore[video.originalPlaylistId]) {
                    playlistsToRestore[video.originalPlaylistId] = {
                        title: video.originalPlaylistTitle || 'Restored Playlist',
                        videos: []
                    };
                }
                playlistsToRestore[video.originalPlaylistId].videos.push(video);
            }
        });

        if (Object.keys(playlistsToRestore).length === 0) {
            showToast('This playlist was not created by merging - cannot unmerge!', error);
            return;
        }

        // Update videos with their original playlist info
        const updatedVideos = videos.map(video => {
            if (video.playlistId === currentEditingPlaylistId && video.originalPlaylistId) {
                return {
                    ...video,
                    playlistId: video.originalPlaylistId,
                    playlistTitle: video.originalPlaylistTitle,
                    originalPlaylistId: undefined,
                    originalPlaylistTitle: undefined
                };
            }
            return video;
        });

        localStorage.setItem('videos', JSON.stringify(updatedVideos));
        loadVideos();
        closePlaylistEdit();
        showToast(`Playlist unmerged successfully! Videos restored to their original playlists.`, succes);
    }
}

// Update the mergePlaylists function to store original playlist info
function mergePlaylists(sourcePlaylistId, targetPlaylistId) {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const targetPlaylistTitle = getPlaylistTitle(targetPlaylistId);

    // Generate a new ID for the merged playlist
    const mergedPlaylistId = MERGED_PLAYLIST_PREFIX + Date.now();

    // Update all videos from both playlists
    const updatedVideos = videos.map(video => {
        if (video.playlistId === sourcePlaylistId || video.playlistId === targetPlaylistId) {
            return {
                ...video,
                originalPlaylistId: video.playlistId, // Store original playlist ID
                originalPlaylistTitle: video.playlistTitle, // Store original title
                playlistId: mergedPlaylistId,
                playlistTitle: `Merged: ${targetPlaylistTitle}`
            };
        }
        return video;
    });

    localStorage.setItem('videos', JSON.stringify(updatedVideos));
    loadVideos();
    closeMergeDialog();
    closePlaylistEdit();
    showToast(`Playlists merged successfully! Created new merged playlist.`, success);
}

// Add event listener for the unmerge button
document.getElementById('unmerge-playlist-btn').addEventListener('click', unmergePlaylist);

// Add this new function to player.js
function sharePlaylist(playlistId, playlistTitle, videos) {
    // Create a shareable link with all video IDs
    const videoIds = videos.map(v => v.id).join(',');
    const shareUrl = `${window.location.origin}${window.location.pathname}?playlist=${playlistId}&videos=${videoIds}`;

    // Create a share popup
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>Share Playlist</h3>
                <span class="material-symbols-outlined close-popup" onclick="closePopup()">close</span>
            </div>
            <div class="popup-body">
                <p>Share <strong>${playlistTitle}</strong> with others</p>
                <div class="share-options">
                    <input type="text" id="playlist-share-url" value="${shareUrl}" readonly>
                    <button onclick="copyPlaylistUrl()" class="copy-btn">
                        <span class="material-symbols-outlined">content_copy</span>
                    </button>
                </div>
                <div class="social-share-buttons">
                    <button onclick="shareToTwitter()" class="twitter-share">
                        <span class="icon-twitter"></span> Twitter
                    </button>
                    <button onclick="shareToWhatsApp()" class="whatsapp-share">
                        <span class="icon-whatsapp"></span> WhatsApp
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    document.body.style.overflow = 'hidden';
}

// Add these helper functions
function copyPlaylistUrl() {
    const input = document.getElementById('playlist-share-url');
    input.select();
    document.execCommand('copy');
    showToast('Playlist URL copied to clipboard!', success);
}

function shareToTwitter() {
    const url = document.getElementById('playlist-share-url').value;
    const playlistTitle = document.getElementById('playlist-edit-title').textContent;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this playlist: ${playlistTitle}`)}&url=${encodeURIComponent(url)}`, '_blank');
}

function shareToWhatsApp() {
    const url = document.getElementById('playlist-share-url').value;
    const playlistTitle = document.getElementById('playlist-edit-title').textContent;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${playlistTitle} - ${url}`)}`, '_blank');
}
// Add these at the top with other global variables
let isDarkMode = false;
let autoPlayNext = true;
let currentPlaybackSpeed = 1;
let currentQuality = 'default';
let currentSubtitle = 'none';
let isMiniPlayerActive = false;
let isTheaterMode = false;

// Settings toggle functionality
document.getElementById('player-settings-toggle').addEventListener('click', function (e) {
    e.stopPropagation();
    document.querySelector('.player-settings-dropdown').classList.toggle('hidden');
});

// Close settings when clicking outside
document.addEventListener('click', function (e) {
    if (!e.target.closest('.player-settings-btn')) {
        document.querySelector('.player-settings-dropdown').classList.add('hidden');
    }
});

// 1. Import/Export Playlists
// Updated showImportExportMenu function
function showImportExportMenu() {
    const modal = document.createElement('div');
    modal.className = 'import-export-modal';
    modal.innerHTML = `
        <div class="import-export-content">
            <div class="import-export-tabs">
                <div class="import-export-tab active" data-tab="export">Export</div>
                <div class="import-export-tab" data-tab="import">Import</div>
            </div>
            <hr>
            <div class="import-export-panel active" id="export-panel">
                <p>Select playlists to export:</p>
                <div id="playlist-selection"></div>
                <div class="export-options">
                    <label><input type="radio" name="export-format" value="json" active checked> JSON Format</label>
                    <label><input type="radio" name="export-format" value="csv"> CSV Format</label>
                </div>
                <textarea class="import-export-textarea" id="export-textarea" readonly></textarea>
                <div class="import-export-actions">
                    <button onclick="copyExportData()">Copy</button>
                    <button onclick="downloadExportData()">Download</button>
                    <button class="secondary-btn" onclick="closeModal(this.closest('.import-export-modal'))">Cancel</button>
                </div>
            </div>
            <div class="import-export-panel" id="import-panel">
                <p>Paste your exported data:</p>
                <textarea class="import-export-textarea" id="import-textarea" placeholder="Paste your JSON or CSV data here..."></textarea>
                <div class="import-export-actions">
                    <button onclick="importPlaylistData()">Import</button>
                    <button class="secondary-btn" onclick="closeModal(this.closest('.import-export-modal'))">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Load playlist selection
    loadPlaylistSelection();

    // Tab switching
    const tabs = modal.querySelectorAll('.import-export-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.import-export-panel').forEach(panel => {
                panel.classList.remove('active');
            });

            document.getElementById(`${this.dataset.tab}-panel`).classList.add('active');
        });
    });

    // Update export data when selection changes
    modal.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
        input.addEventListener('change', updateExportData);
    });
}

function loadPlaylistSelection() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const playlists = {};
    const container = document.getElementById('playlist-selection');

    // Group videos by playlist
    videos.forEach(video => {
        if (video.playlistId) {
            if (!playlists[video.playlistId]) {
                playlists[video.playlistId] = {
                    title: video.playlistTitle || 'Untitled Playlist',
                    videos: []
                };
            }
            playlists[video.playlistId].videos.push(video);
        }
    });

    container.innerHTML = '';

    // Add "All Playlists" option
    const allCheckbox = document.createElement('div');
    allCheckbox.className = 'playlist-checkbox';
    allCheckbox.innerHTML = `
        <label>
            <input type="checkbox" id="select-all-playlists" checked>
            <strong>All Playlists</strong>
        </label>
    `;
    container.appendChild(allCheckbox);

    // Add individual playlists
    Object.keys(playlists).forEach(playlistId => {
        const playlist = playlists[playlistId];
        const checkbox = document.createElement('div');
        checkbox.className = 'playlist-checkbox';
        checkbox.innerHTML = `
            <label>
                <input type="checkbox" class="playlist-checkbox-item" data-playlist-id="${playlistId}" checked>
                <p>${playlist.title}</p> <p>(${playlist.videos.length} videos)</p>
            </label>
        `;
        container.appendChild(checkbox);
    });

    // Select all/none functionality
    document.getElementById('select-all-playlists').addEventListener('change', function () {
        const checkboxes = document.querySelectorAll('.playlist-checkbox-item');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
}

function updateExportData() {
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const selectedPlaylists = Array.from(document.querySelectorAll('.playlist-checkbox-item:checked')).map(el => el.dataset.playlistId);
    const videos = JSON.parse(localStorage.getItem('videos')) || [];

    let exportData;

    if (format === 'csv') {
        // Generate CSV
        let csvContent = "Title,Video ID,URL,Playlist,Status\n";

        videos.forEach(video => {
            if (selectedPlaylists.length === 0 || selectedPlaylists.includes(video.playlistId)) {
                csvContent += `"${video.title.replace(/"/g, '""')}",${video.id},https://youtube.com/watch?v=${video.id},"${video.playlistTitle || ''}",${video.status || 'not-started'}\n`;
            }
        });

        exportData = csvContent;
    } else {
        // Generate JSON
        exportData = {};

        videos.forEach(video => {
            if (selectedPlaylists.length === 0 || selectedPlaylists.includes(video.playlistId)) {
                const playlistId = video.playlistId || 'standalone';
                if (!exportData[playlistId]) {
                    exportData[playlistId] = {
                        title: video.playlistTitle || 'Standalone Videos',
                        videos: []
                    };
                }
                exportData[playlistId].videos.push(video);
            }
        });

        exportData = JSON.stringify(exportData, null, 2);
    }

    document.getElementById('export-textarea').value = exportData;
}

// Updated copyExportData function
function copyExportData() {
    const textarea = document.getElementById('export-textarea');
    textarea.select();
    document.execCommand('copy');
    showToast('Playlist data copied to clipboard!', success);
}

// Updated downloadExportData function
function downloadExportData() {
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const data = document.getElementById('export-textarea').value;
    const filename = `mixify_export.${format}`;
    const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json';

    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Updated importPlaylistData function
function importPlaylistData() {
    try {
        const format = document.querySelector('input[name="import-format"]:checked').value;
        const input = document.getElementById('import-textarea').value.trim();

        if (!input) {
            showToast('Please paste your data first', warning);
            return;
        }

        let videos = JSON.parse(localStorage.getItem('videos')) || [];
        let importedCount = 0;

        if (format === 'csv') {
            // Parse CSV
            const lines = input.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                const videoData = {};

                headers.forEach((header, index) => {
                    let value = values[index] || '';
                    // Remove surrounding quotes if present
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    videoData[header] = value;
                });

                if (videoData['video id'] || videoData['videoid']) {
                    const videoId = videoData['video id'] || videoData['videoid'];
                    const existingIndex = videos.findIndex(v => v.id === videoId);

                    const newVideo = {
                        id: videoId,
                        title: videoData.title || `Video ${videoId}`,
                        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                        status: videoData.status || 'not-started',
                        playlistId: videoData.playlist ? `imported_${hashString(videoData.playlist)}` : undefined,
                        playlistTitle: videoData.playlist || undefined
                    };

                    if (existingIndex >= 0) {
                        videos[existingIndex] = newVideo;
                    } else {
                        videos.push(newVideo);
                    }
                    importedCount++;
                }
            }
        } else {
            // Parse JSON
            const importData = JSON.parse(input);

            Object.keys(importData).forEach(key => {
                const playlist = importData[key];

                playlist.videos.forEach(video => {
                    const existingIndex = videos.findIndex(v => v.id === video.id);

                    const newVideo = {
                        ...video,
                        playlistId: playlist.title ? `imported_${hashString(playlist.title)}` : undefined,
                        playlistTitle: playlist.title || undefined
                    };

                    if (existingIndex >= 0) {
                        videos[existingIndex] = newVideo;
                    } else {
                        videos.push(newVideo);
                    }
                    importedCount++;
                });
            });
        }

        localStorage.setItem('videos', JSON.stringify(videos));
        loadVideos();
        showToast(`Successfully imported ${importedCount} videos!`, success);
        closeModal(document.querySelector('.import-export-modal'));
    } catch (e) {
        showToast('Error importing data. Please check your data format.', success);
        console.error(e);
    }
    filterVideos();
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

function copyExportData() {
    const textarea = document.getElementById('export-textarea');
    textarea.select();
    document.execCommand('copy');
    showToast('Playlist data copied to clipboard!', success);
}

function downloadExportData() {
    const data = document.getElementById('export-textarea').value;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mixify_playlists_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Replace the existing importPlaylistData function with this:
function importPlaylistData() {
    try {
        const input = document.getElementById('import-textarea').value.trim();

        if (!input) {
            showToast('Please paste your data first', 'warning');
            return;
        }

        // Auto-detect format
        let format;
        if (input.startsWith('{') || input.startsWith('[')) {
            format = 'json';
        } else if (input.includes(',') && input.includes('\n')) {
            format = 'csv';
        } else {
            showToast('Unable to detect data format. Please use JSON or CSV.', 'error');
            return;
        }

        let videos = JSON.parse(localStorage.getItem('videos')) || [];
        let importedCount = 0;
        let skippedCount = 0;

        if (format === 'csv') {
            // Parse CSV
            const lines = input.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                try {
                    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    const videoData = {};

                    headers.forEach((header, index) => {
                        let value = values[index] || '';
                        // Remove surrounding quotes if present
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.slice(1, -1);
                        }
                        videoData[header] = value;
                    });

                    if (videoData['video id'] || videoData['videoid']) {
                        const videoId = videoData['video id'] || videoData['videoid'];

                        // Basic validation
                        if (!videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
                            skippedCount++;
                            continue;
                        }

                        const existingIndex = videos.findIndex(v => v.id === videoId);

                        const newVideo = {
                            id: videoId,
                            title: videoData.title || `Video ${videoId}`,
                            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                            status: videoData.status || 'not-started',
                            playlistId: videoData.playlist ? `imported_${hashString(videoData.playlist)}` : undefined,
                            playlistTitle: videoData.playlist || undefined
                        };

                        if (existingIndex >= 0) {
                            videos[existingIndex] = newVideo;
                        } else {
                            videos.push(newVideo);
                        }
                        importedCount++;
                    }
                } catch (e) {
                    skippedCount++;
                    console.error('Error processing CSV line:', e);
                }
            }
        } else {
            // Parse JSON
            try {
                const importData = JSON.parse(input);
                const isArray = Array.isArray(importData);

                // Handle both array and object formats
                const items = isArray ? importData : Object.values(importData).flatMap(x => x.videos || x);

                items.forEach(video => {
                    try {
                        if (!video.id || !video.id.match(/^[a-zA-Z0-9_-]{11}$/)) {
                            skippedCount++;
                            return;
                        }

                        const existingIndex = videos.findIndex(v => v.id === video.id);

                        const newVideo = {
                            ...video,
                            playlistId: video.playlistId || (video.playlistTitle ? `imported_${hashString(video.playlistTitle)}` : undefined),
                            playlistTitle: video.playlistTitle || undefined,
                            status: video.status || 'not-started'
                        };

                        if (existingIndex >= 0) {
                            videos[existingIndex] = newVideo;
                        } else {
                            videos.push(newVideo);
                        }
                        importedCount++;
                    } catch (e) {
                        skippedCount++;
                        console.error('Error processing video:', e);
                    }
                });
            } catch (e) {
                showToast('Invalid JSON data. Please check your import file.', 'error');
                console.error(e);
                return;
            }
        }

        localStorage.setItem('videos', JSON.stringify(videos));
        loadVideos();

        let message = `Successfully imported ${importedCount} videos!`;
        if (skippedCount > 0) {
            message += ` (${skippedCount} invalid entries skipped)`;
        }

        showToast(message, 'success');
        closeModal(document.querySelector('.import-export-modal'));
    } catch (e) {
        showToast('Error importing data. Please check your data format.', 'error');
        console.error(e);
    }
}
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
    document.querySelector('.player-settings-dropdown').classList.add('hidden');
}

// Initialize dark mode from localStorage
if (localStorage.getItem('darkMode') === 'true') {
    toggleDarkMode();
}

// 3. Auto-play Next Video
function toggleAutoPlay() {
    autoPlayNext = !autoPlayNext;
    localStorage.setItem('autoPlayNext', autoPlayNext);
    document.querySelector('.player-settings-dropdown').classList.add('hidden');

    // Update button text
    const autoPlayBtn = document.querySelector('.settings-option[onclick="toggleAutoPlay()"]');
    if (autoPlayBtn) {
        autoPlayBtn.innerHTML = `
            <span class="material-symbols-outlined">play_circle</span>
            Auto-play<span class="status-indicator ${autoPlayNext ? 'ON' : 'OFF'}">${autoPlayNext ? 'ON' : 'OFF'}</span>
        `;
    }
}

// Initialize auto-play from localStorage
if (localStorage.getItem('autoPlayNext') === 'true') {
    autoPlayNext = true;
}

// Update onPlayerStateChange to handle auto-play
const originalOnPlayerStateChange = onPlayerStateChange;
onPlayerStateChange = function (event) {
    originalOnPlayerStateChange(event);

    if (event.data === YT.PlayerState.ENDED && autoPlayNext) {
        playNextVideo();
    }
};

// 4. Playback Speed Control
function showPlaybackSpeedMenu() {
    const modal = document.createElement('div');
    modal.className = 'speed-menu';
    modal.innerHTML = `
        <div class="menu-header">
            <h3>Play Speed</h3>
            <button class="menu-close" onclick="closeModal(this.parentElement.parentElement)">×</button>
        </div>
        <div class="menu-options">
            <div class="menu-option ${currentPlaybackSpeed === 0.25 ? 'active' : ''}" onclick="setPlaybackSpeed(0.25)">0.25x</div>
            <div class="menu-option ${currentPlaybackSpeed === 0.5 ? 'active' : ''}" onclick="setPlaybackSpeed(0.5)">0.5x</div>
            <div class="menu-option ${currentPlaybackSpeed === 0.75 ? 'active' : ''}" onclick="setPlaybackSpeed(0.75)">0.75x</div>
            <div class="menu-option ${currentPlaybackSpeed === 1 ? 'active' : ''}" onclick="setPlaybackSpeed(1)">Normal (1x)</div>
            <div class="menu-option ${currentPlaybackSpeed === 1.25 ? 'active' : ''}" onclick="setPlaybackSpeed(1.25)">1.25x</div>
            <div class="menu-option ${currentPlaybackSpeed === 1.5 ? 'active' : ''}" onclick="setPlaybackSpeed(1.5)">1.5x</div>
            <div class="menu-option ${currentPlaybackSpeed === 1.75 ? 'active' : ''}" onclick="setPlaybackSpeed(1.75)">1.75x</div>
            <div class="menu-option ${currentPlaybackSpeed === 2 ? 'active' : ''}" onclick="setPlaybackSpeed(2)">2x</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    document.querySelector('.player-settings-dropdown').classList.add('hidden');
}

function setPlaybackSpeed(speed) {
    currentPlaybackSpeed = speed;
    if (player && player.setPlaybackRate) {
        player.setPlaybackRate(speed);
    }
    localStorage.setItem('playbackSpeed', speed);
    closeModal(document.querySelector('.speed-menu'));
}

// Initialize playback speed from localStorage
if (localStorage.getItem('playbackSpeed')) {
    currentPlaybackSpeed = parseFloat(localStorage.getItem('playbackSpeed'));
    if (player && player.setPlaybackRate) {
        player.setPlaybackRate(currentPlaybackSpeed);
    }
}

// 5. Video Quality Control
function showQualityMenu() {
    const modal = document.createElement('div');
    modal.className = 'quality-menu';
    modal.innerHTML = `
        <div class="menu-header">
            <h3>Video Quality</h3>
            <button class="menu-close" onclick="closeModal(this.parentElement.parentElement)">×</button>
        </div>
        <div class="menu-options">
            <div class="menu-option ${currentQuality === 'default' ? 'active' : ''}" onclick="setVideoQuality('default')">Auto (Default)</div>
            <div class="menu-option ${currentQuality === 'small' ? 'active' : ''}" onclick="setVideoQuality('small')">240p</div>
            <div class="menu-option ${currentQuality === 'medium' ? 'active' : ''}" onclick="setVideoQuality('medium')">360p</div>
            <div class="menu-option ${currentQuality === 'large' ? 'active' : ''}" onclick="setVideoQuality('large')">480p</div>
            <div class="menu-option ${currentQuality === 'hd720' ? 'active' : ''}" onclick="setVideoQuality('hd720')">720p HD</div>
            <div class="menu-option ${currentQuality === 'hd1080' ? 'active' : ''}" onclick="setVideoQuality('hd1080')">1080p HD</div>
            <div class="menu-option ${currentQuality === 'highres' ? 'active' : ''}" onclick="setVideoQuality('highres')">High Resolution</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    document.querySelector('.player-settings-dropdown').classList.add('hidden');
}

function setVideoQuality(quality) {
    currentQuality = quality;
    if (player && player.setPlaybackQuality) {
        player.setPlaybackQuality(quality);
    }
    localStorage.setItem('videoQuality', quality);
    closeModal(document.querySelector('.quality-menu'));
}

// Initialize video quality from localStorage
if (localStorage.getItem('videoQuality')) {
    currentQuality = localStorage.getItem('videoQuality');
    if (player && player.setPlaybackQuality) {
        player.setPlaybackQuality(currentQuality);
    }
}

// 6. Subtitles Control
function showSubtitleMenu() {
    const modal = document.createElement('div');
    modal.className = 'subtitle-menu';
    modal.innerHTML = `
        <div class="menu-header">
            <h3>Subtitles</h3>
            <button class="menu-close" onclick="closeModal(this.parentElement.parentElement)">×</button>
        </div>
        <div class="menu-options">
            <div class="menu-option ${currentSubtitle === 'none' ? 'active' : ''}" onclick="setSubtitles('none')">Off</div>
            <div class="menu-option" onclick="showToast('This feature requires YouTube video to have subtitles available',error)">English</div>
            <div class="menu-option" onclick="showToast('This feature requires YouTube video to have subtitles available',error)">Spanish</div>
            <div class="menu-option" onclick="showToast('This feature requires YouTube video to have subtitles available',error)">French</div>
            <div class="menu-option" onclick="showToast('This feature requires YouTube video to have subtitles available',error)">German</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    document.querySelector('.player-settings-dropdown').classList.add('hidden');
}

function setSubtitles(language) {
    currentSubtitle = language;
    // Note: YouTube API doesn't provide direct control over subtitles in the iframe player
    // This would require a custom player implementation
    closeModal(document.querySelector('.subtitle-menu'));
}

// // 7. Keyboard Shortcuts
// function showKeyboardShortcuts() {
//     const modal = document.createElement('div');
//     modal.className = 'shortcuts-menu';
//     modal.innerHTML = `
//         <div class="menu-header">
//             <h3>Keyboard Shortcuts</h3>
//             <button class="menu-close" onclick="closeModal(this.parentElement.parentElement)">×</button>
//         </div>
//         <div class="menu-options">
//             <div class="menu-option"><strong>Space</strong> - Play/Pause</div>
//             <div class="menu-option"><strong>→</strong> - Seek forward 5 sec</div>
//             <div class="menu-option"><strong>←</strong> - Seek backward 5 sec</div>
//             <div class="menu-option"><strong>↑</strong> - Volume up</div>
//             <div class="menu-option"><strong>↓</strong> - Volume down</div>
//             <div class="menu-option"><strong>M</strong> - Mute</div>
//             <div class="menu-option"><strong>F</strong> - Fullscreen</div>
//             <div class="menu-option"><strong>N</strong> - Next video</div>
//             <div class="menu-option"><strong>P</strong> - Previous video</div>
//             <div class="menu-option"><strong>0-9</strong> - Jump to percentage</div>
//         </div>
//     `;
//     document.body.appendChild(modal);
//     modal.style.display = 'block';
//     document.querySelector('.player-settings-dropdown').classList.add('hidden');
// }

// // Add keyboard shortcuts
// document.addEventListener('keydown', function (e) {
//     if (!player) return;

//     switch (e.key) {
//         case ' ':
//             if (player.getPlayerState() === YT.PlayerState.PLAYING) {
//                 player.pauseVideo();
//             } else {
//                 player.playVideo();
//             }
//             break;
//         case 'ArrowRight':
//             player.seekTo(player.getCurrentTime() + 5, true);
//             break;
//         case 'ArrowLeft':
//             player.seekTo(player.getCurrentTime() - 5, true);
//             break;
//         case 'ArrowUp':
//             player.setVolume(Math.min(player.getVolume() + 10, 100));
//             break;
//         case 'ArrowDown':
//             player.setVolume(Math.max(player.getVolume() - 10, 0));
//             break;
//         case 'm':
//         case 'M':
//             if (player.isMuted()) {
//                 player.unMute();
//             } else {
//                 player.mute();
//             }
//             break;
//         case 'f':
//         case 'F':
//             const iframe = document.querySelector('#player iframe');
//             if (iframe.requestFullscreen) {
//                 iframe.requestFullscreen();
//             } else if (iframe.webkitRequestFullscreen) {
//                 iframe.webkitRequestFullscreen();
//             } else if (iframe.msRequestFullscreen) {
//                 iframe.msRequestFullscreen();
//             }
//             break;
//         case 'n':
//         case 'N':
//             playNextVideo();
//             break;
//         case 'p':
//         case 'P':
//             playPreviousVideo();
//             break;
//         case '0': case '1': case '2': case '3': case '4':
//         case '5': case '6': case '7': case '8': case '9':
//             const percentage = parseInt(e.key) * 10;
//             player.seekTo(player.getDuration() * (percentage / 100), true);
//             break;
//     }
// });

// 8. Stats for Nerds
function showStatsForNerds() {
    const modal = document.createElement('div');
    modal.className = 'stats-menu';
    modal.innerHTML = `
        <div class="menu-header">
            <h3>Stats for Nerds</h3>
            <button class="menu-close" onclick="closeModal(this.parentElement.parentElement)">×</button>
        </div>
        <div class="stats-container" id="stats-container">
            <div class="stats-row"><span>Current Video:</span> <span id="stats-video-id">${currentVideoId || 'N/A'}</span></div>
            <div class="stats-row"><span>Resolution:</span> <span id="stats-resolution">N/A</span></div>
            <div class="stats-row"><span>FPS:</span> <span id="stats-fps">N/A</span></div>
            <div class="stats-row"><span>Volume:</span> <span id="stats-volume">N/A</span></div>
            <div class="stats-row"><span>Playback Rate:</span> <span id="stats-playback-rate">N/A</span></div>
            <div class="stats-row"><span>Current Time:</span> <span id="stats-current-time">N/A</span></div>
            <div class="stats-row"><span>Duration:</span> <span id="stats-duration">N/A</span></div>
            <div class="stats-row"><span>Buffered:</span> <span id="stats-buffered">N/A</span></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    document.querySelector('.player-settings-dropdown').classList.add('hidden');

    // Start updating stats
    const statsInterval = setInterval(() => {
        if (!modal.isConnected) {
            clearInterval(statsInterval);
            return;
        }

        updateStats();
    }, 1000);

    // Store interval ID on modal for cleanup
    modal.statsInterval = statsInterval;
}

function updateStats() {
    if (!player) return;

    try {
        document.getElementById('stats-video-id').textContent = currentVideoId || 'N/A';
        document.getElementById('stats-volume').textContent = player.getVolume() + '%';
        document.getElementById('stats-playback-rate').textContent = player.getPlaybackRate() + 'x';
        document.getElementById('stats-current-time').textContent = formatTime(player.getCurrentTime());
        document.getElementById('stats-duration').textContent = formatTime(player.getDuration());

        // These would require more advanced player implementation
        document.getElementById('stats-resolution').textContent = 'Auto';
        document.getElementById('stats-fps').textContent = 'N/A';
        document.getElementById('stats-buffered').textContent = 'N/A';
    } catch (e) {
        console.error('Error updating stats:', e);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// 9. Mini Player
function toggleMiniPlayer() {
    isMiniPlayerActive = !isMiniPlayerActive;
    localStorage.setItem('miniPlayer', isMiniPlayerActive);

    // Update button text
    const miniPlayerBtn = document.querySelector('.settings-option[onclick="toggleMiniPlayer()"]');
    if (miniPlayerBtn) {
        miniPlayerBtn.innerHTML = `
            <span class="material-symbols-outlined">picture_in_picture_alt</span>
            Mini Player <span class="status-indicator ${isMiniPlayerActive ? 'ON' : 'OFF'}">${isMiniPlayerActive ? 'ON' : 'OFF'}</span>
        `;
    }

    if (isMiniPlayerActive) {
        createMiniPlayer();
    } else {
        removeMiniPlayer();
    }

    document.querySelector('.player-settings-dropdown').classList.add('hidden');
}
function createMiniPlayer() {
    if (!currentVideoId) {
        showToast('No video is currently playing', warning);
        isMiniPlayerActive = false;
        return;
    }

    const miniPlayer = document.createElement('div');
    miniPlayer.className = 'mini-player';
    miniPlayer.innerHTML = `
        <iframe id="mini-player-iframe" src="https://www.youtube.com/embed/${currentVideoId}?enablejsapi=1&autoplay=1" frameborder="0" allowfullscreen></iframe>
        <div class="mini-player-controls">
            <button class="mini-player-btn" onclick="toggleMiniPlayer()">
                <span class="material-symbols-outlined">close</span>
            </button>
            <button class="mini-player-btn" id="mini-player-play-pause">
                <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <button class="mini-player-btn" id="mini-player-mute">
                <span class="material-symbols-outlined">volume_up</span>
            </button>
        </div>
    `;
    document.body.appendChild(miniPlayer);

    // Initialize the mini player
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onMiniPlayerReady = function (event) {
        miniPlayer.player = event.target;
        syncMiniPlayerWithMain();
    };

    window.onMiniPlayerStateChange = function (event) {
        if (event.data === YT.PlayerState.ENDED) {
            removeMiniPlayer();
        }
    };

    // Add event listeners
    document.getElementById('mini-player-play-pause').addEventListener('click', miniPlayerPlayPause);
    document.getElementById('mini-player-mute').addEventListener('click', miniPlayerMute);
}

function syncMiniPlayerWithMain() {
    if (!miniPlayer.player || !player) return;

    miniPlayer.player.setVolume(player.getVolume());
    miniPlayer.player.setPlaybackRate(player.getPlaybackRate());

    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        miniPlayer.player.playVideo();
    } else {
        miniPlayer.player.pauseVideo();
    }
}

function onMiniPlayerReady(event) {
    // Sync with main player
    if (player) {
        event.target.setVolume(player.getVolume());
        event.target.setPlaybackRate(player.getPlaybackRate());

        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
            event.target.playVideo();
        } else {
            event.target.pauseVideo();
        }
    }
}

function miniPlayerPlayPause() {
    const iframe = document.querySelector('.mini-player iframe');
    if (iframe && iframe.player) {
        if (iframe.player.getPlayerState() === YT.PlayerState.PLAYING) {
            iframe.player.pauseVideo();
        } else {
            iframe.player.playVideo();
        }
    }
}

function miniPlayerMute() {
    const iframe = document.querySelector('.mini-player iframe');
    if (iframe && iframe.player) {
        if (iframe.player.isMuted()) {
            iframe.player.unMute();
        } else {
            iframe.player.mute();
        }
    }
}

function removeMiniPlayer() {
    const miniPlayer = document.querySelector('.mini-player');
    if (miniPlayer) {
        miniPlayer.remove();
    }
}

// 10. Theater Mode
function showTheaterMode() {
    isTheaterMode = !isTheaterMode;
    document.body.classList.toggle('theater-mode', isTheaterMode);
    localStorage.setItem('theaterMode', isTheaterMode);
    document.querySelector('.player-settings-dropdown').classList.add('hidden');
}

// Initialize theater mode from localStorage
function showTheaterMode() {
    isTheaterMode = !isTheaterMode;
    document.body.classList.toggle('theater-mode', isTheaterMode);
    localStorage.setItem('theaterMode', isTheaterMode);

    // Update button text
    const theaterBtn = document.querySelector('.settings-option[onclick="showTheaterMode()"]');
    if (theaterBtn) {
        theaterBtn.innerHTML = `
            <span class="material-symbols-outlined">theaters</span>
            Theater <span class="status-indicator ${isTheaterMode ? 'ON' : 'OFF'}">${isTheaterMode ? 'ON' : 'OFF'}</span>
        `;
    }

    document.querySelector('.player-settings-dropdown').classList.add('hidden');
}

// Helper function to close modals
function closeModal(modal) {
    if (modal && modal.parentNode) {
        // Clear any intervals
        if (modal.statsInterval) {
            clearInterval(modal.statsInterval);
        }

        modal.parentNode.removeChild(modal);
        document.body.style.overflow = 'auto';
    }
}

// Add this to the end of your existing player.js
// Initialize all settings from localStorage when player is ready
function onPlayerReady(event) {
    console.log('Player is ready');
    loadVideos();
    setupNavigationButtons();

    // Apply saved settings
    if (localStorage.getItem('playbackSpeed')) {
        setPlaybackSpeed(parseFloat(localStorage.getItem('playbackSpeed')));
    }
    if (localStorage.getItem('videoQuality')) {
        setVideoQuality(localStorage.getItem('videoQuality'));
    }
}
// Add this near the top with other global variables
let showSingleVideos = false;

// Add this function to filter videos
function filterVideos() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const container = document.getElementById('video-grid');

    if (showSingleVideos) {
        // Show only single videos
        const singleVideos = videos.filter(video => !video.playlistId);

        container.innerHTML = `
            <div class="single-videos-grid" id="single-videos-container">
                ${singleVideos.map(video => `
                    <div class="single-video-item">
                        ${createVideoCard(video).innerHTML}
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // Show all videos (original behavior)
        loadVideos();
    }
}

// Add event listeners for filter buttons
document.getElementById('show-all-btn').addEventListener('click', function () {
    showSingleVideos = false;
    document.getElementById('show-all-btn').classList.add('active');
    document.getElementById('show-single-btn').classList.remove('active');
    filterVideos();
});

document.getElementById('show-single-btn').addEventListener('click', function () {
    showSingleVideos = true;
    document.getElementById('show-single-btn').classList.add('active');
    document.getElementById('show-all-btn').classList.remove('active');
    filterVideos();
});

// Update the loadVideos function to use the filter
const originalLoadVideos = window.loadVideos;
window.loadVideos = function () {
    if (showSingleVideos) {
        filterVideos();
    } else {
        originalLoadVideos();
    }
};
// Toast notification system
// Enhanced Toast Notification System
function showToast(message, type = 'info', duration = 3000) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    toast.innerHTML = `
        <span class="material-symbols-outlined toast-icon">${icons[type] || 'info'}</span>
        <div style="flex:1">${message}</div>
        <span class="material-symbols-outlined toast-close">close</span>
        <div class="toast-progress"><div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div></div>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove after duration
    const timer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);

    // Manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timer);
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Fix: Properly track playback history and calculate stats
function trackPlaybackHistory() {
    if (!player || !currentVideoId) return;

    const history = JSON.parse(localStorage.getItem('playbackHistory')) || [];

    // Remove old entries (keep only last 100)
    if (history.length > 100) {
        history.splice(100);
    }

    history.unshift({
        videoId: currentVideoId,
        date: new Date().toISOString(),
        duration: player.getCurrentTime(),
        completed: player.getPlayerState() === YT.PlayerState.ENDED
    });

    localStorage.setItem('playbackHistory', JSON.stringify(history));
}

// Fix: Show proper analytics with more details
function showVideoAnalytics() {
    if (!currentVideoId) {
        showToast('No video selected', 'error');
        return;
    }

    const history = JSON.parse(localStorage.getItem('playbackHistory')) || [];
    const videoHistory = history.filter(h => h.videoId === currentVideoId);

    if (videoHistory.length === 0) {
        showToast('No analytics data available', 'info');
        return;
    }

    const totalWatches = videoHistory.length;
    const completedWatches = videoHistory.filter(h => h.completed).length;
    const averageWatchTime = (videoHistory.reduce((sum, h) => sum + h.duration, 0) / totalWatches).toFixed(1);
    const lastWatched = new Date(videoHistory[0].date).toLocaleString();
    const completionRate = ((completedWatches / totalWatches) * 100).toFixed(0);

    showToast(
        `Watched ( ${totalWatches} ) times \n Completed ${completionRate}% \n Avg: ${averageWatchTime}s \n\n Last Watched: ${lastWatched}`,
        'info',
        6000
    );
}

// Add this to onPlayerStateChange
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED && currentVideoId) {
        markAsComplete(currentVideoId);
        addToRecentlyPlayed(currentVideoId, true);
    }
    else if (event.data === YT.PlayerState.PLAYING && currentVideoId) {
        addToRecentlyPlayed(currentVideoId, false);
    }
    trackPlaybackHistory();
}

// Feature 5: Recommendations
// Fix: Improve recommendation algorithm
function getRecommendations() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const history = JSON.parse(localStorage.getItem('playbackHistory')) || [];

    if (videos.length === 0 || history.length === 0) {
        return [];
    }

    // Get most watched playlist IDs
    const playlistCounts = {};
    history.forEach(h => {
        const video = videos.find(v => v.id === h.videoId);
        if (video?.playlistId) {
            playlistCounts[video.playlistId] = (playlistCounts[video.playlistId] || 0) + 1;
        }
    });

    // Sort playlists by watch count
    const sortedPlaylists = Object.entries(playlistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3); // Top 3 playlists

    // Get videos from these playlists that haven't been watched recently
    const recommendations = [];
    sortedPlaylists.forEach(([playlistId]) => {
        const playlistVideos = videos.filter(v => v.playlistId === playlistId);
        const unwatched = playlistVideos.filter(video =>
            !history.some(h => h.videoId === video.id)
        );
        recommendations.push(...unwatched.slice(0, 2)); // Max 2 per playlist
    });

    return recommendations.slice(0, 5); // Max 5 recommendations
}

// Fix: Show recommendations in a better format
function showRecommendations() {
    const recommendations = getRecommendations();

    if (recommendations.length === 0) {
        showToast('No recommendations available. Watch more videos to get recommendations.', 'info');
        return;
    }

    // Create a modal for recommendations
    const modal = document.createElement('div');
    modal.className = 'recommendations-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Recommended Videos</h3>
            <div class="recommendations-list">
                ${recommendations.map(video => `
                    <div class="recommendation-item" onclick="playVideo('${video.id}')">
                        <img src="${video.thumbnail}" alt="${video.title}">
                        <p>${video.title}</p>
                    </div>
                `).join('')}
            </div>
            <button class="close-btn" onclick="this.closest('.recommendations-modal').remove()">Close</button>
        </div>
    `;

    document.body.appendChild(modal);
}

// Feature 10: Video Reactions
function addVideoReaction(reaction) {
    if (!currentVideoId) {
        showToast('No video selected', 'error');
        return;
    }

    addReaction(currentVideoId, reaction);
}


// ========== RECOMMENDATIONS FEATURE ========== //
function showRecommendations() {
    const recommendations = getRecommendations();

    if (recommendations.length === 0) {
        showToast('No recommendations available yet. Watch more videos to get recommendations.', 'info');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'recommendations-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Recommended Videos</h3>
            <div class="recommendations-grid">
                ${recommendations.map(video => `
                    <div class="recommendation-item" onclick="playVideo('${video.id}')">
                        <img src="${video.thumbnail}" alt="${video.title}">
                        <h4>${video.title}</h4>
                        ${video.playlistTitle ? `<p>From: ${video.playlistTitle}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            <button class="close-btn" onclick="this.parentElement.parentElement.remove()">Close</button>
        </div>
    `;

    document.body.appendChild(modal);
}


// ========== LIKE/UNLIKE BUTTONS IN VIDEO CARDS ========== //
function updateVideoCardReactions(videoId) {
    const videoCards = document.querySelectorAll(`.stored-video[data-video-id="${videoId}"]`);
    const reactions = JSON.parse(localStorage.getItem('videoReactions')) || {};
    const reaction = reactions[videoId] || 'none';

    videoCards.forEach(card => {
        const reactionDiv = card.querySelector('.reaction');
        if (reactionDiv) {
            reactionDiv.innerHTML = reaction === 'like' ?
                '<span class="material-symbols-outlined liked">thumb_up</span>' :
                '<span class="material-symbols-outlined">thumb_down</span>';
        }
    });
}

function toggleVideoReaction(videoId) {
    const reactions = JSON.parse(localStorage.getItem('videoReactions')) || {};
    reactions[videoId] = reactions[videoId] === 'like' ? 'none' : 'like';
    localStorage.setItem('videoReactions', JSON.stringify(reactions));
    updateVideoCardReactions(videoId);
}

// ========== UPDATE CREATE VIDEO CARD FUNCTION ========== //
function createVideoCard(video) {
    const dotClass = video.status === 'completed' ? 'green-dot' : (video.status === 'not-started' ? 'gray-dot' : '');
    const isPlaylist = video.playlistId ? true : false;

    const slideDiv = document.createElement('div');
    slideDiv.className = showSingleVideos ? 'single-video-item' : 'swiper-slide stored-video';
    slideDiv.setAttribute('data-video-id', video.id);

    // Get reaction for this video
    const reactions = JSON.parse(localStorage.getItem('videoReactions')) || {};
    const reaction = reactions[video.id] || 'none';

    slideDiv.innerHTML = `
        <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" />
        <div class="dot ${dotClass}"></div>
        <h3>${video.title}</h3>
        <div class="control-area">
            <button class="play-button" onclick="playVideo('${video.id}')">
                PLAY
                <span class="material-symbols-outlined">double_arrow</span>
            </button>
            <div class="reaction" onclick="toggleVideoReaction('${video.id}')">
                ${reaction === 'like' ?
            '<span class="material-symbols-outlined liked">thumb_down</span>' :
            '<span class="material-symbols-outlined">thumb_up</span>'}
            </div>
            <button class="settings-btn" onclick="toggleSettings(this)">
                <span class="material-symbols-outlined">settings</span>
            </button>
            <div class="settings-dropdown hidden">
                ${isPlaylist ? `<button class="set-btn" onclick="openPlaylistEdit('${video.playlistId}')">Edit Playlist</button>` : ''}
                <button class="set-btn" onclick="deleteVideo('${video.id}')">Delete Video</button>
                <button class="set-btn" onclick="copyToClipboard('https://www.youtube.com/watch?v=${video.id}')">Copy Video URL</button>
                <button class="set-btn" onclick="copyToClipboard('${video.id}')">Copy Video ID</button>
                <button class="set-btn" onclick="markAsComplete('${video.id}')">Mark as Complete</button>
            </div>
        </div>
    `;

    return slideDiv;
}


// ========== IMPROVED RECOMMENDATIONS ========== //
function getRecommendations() {
    const videos = JSON.parse(localStorage.getItem('videos')) || [];
    const history = JSON.parse(localStorage.getItem('playbackHistory')) || [];

    if (videos.length === 0 || history.length === 0) {
        return [];
    }

    // Get most watched channels
    const channelCounts = {};
    history.forEach(h => {
        const video = videos.find(v => v.id === h.videoId);
        if (video) {
            const channelId = video.channelId || 'unknown';
            channelCounts[channelId] = (channelCounts[channelId] || 0) + 1;
        }
    });

    // Sort channels by watch count
    const sortedChannels = Object.entries(channelCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3); // Top 3 channels

    // Get videos from these channels that haven't been watched recently
    const recommendations = [];
    sortedChannels.forEach(([channelId]) => {
        const channelVideos = videos.filter(v => v.channelId === channelId);
        const unwatched = channelVideos.filter(video =>
            !history.some(h => h.videoId === video.id)
                .slice(0, 2)); // Max 2 per channel
        recommendations.push(...unwatched);
    });

    return recommendations.slice(0, 5); // Max 5 recommendations
}
function updateAllLikeButtons(videoId) {
    // Update video card reactions
    updateVideoCardReactions(videoId);

    // Update player reaction buttons
    const reactions = JSON.parse(localStorage.getItem('videoReactions')) || {};
    const reaction = reactions[videoId] || 'none';

    const likeBtn = document.querySelector('.reaction-buttons .like-btn');
    const dislikeBtn = document.querySelector('.reaction-buttons .dislike-btn');

    if (likeBtn && dislikeBtn) {
        if (reaction === 'like') {
            likeBtn.innerHTML = '<span class="material-symbols-outlined liked">thumb_up</span>';
            dislikeBtn.innerHTML = '<span class="material-symbols-outlined">thumb_down</span>';
        } else {
            likeBtn.innerHTML = '<span class="material-symbols-outlined">thumb_up</span>';
            dislikeBtn.innerHTML = '<span class="material-symbols-outlined">thumb_down</span>';
        }
    }

    currentVideoReaction = reaction;
}

function toggleVideoReaction(videoId, reactionType) {
    const reactions = JSON.parse(localStorage.getItem('videoReactions')) || {};

    // If clicking the same reaction again, remove it
    if (reactions[videoId] === reactionType) {
        delete reactions[videoId];
        showToast('Reaction removed', 'info');
    }
    // If clicking a different reaction, change it
    else {
        reactions[videoId] = reactionType;
        showToast(`Video ${reactionType}d`, 'success');
    }

    localStorage.setItem('videoReactions', JSON.stringify(reactions));
    updateAllLikeButtons(videoId);
}
function setupReactionButtons() {
    const reactionButtons = document.querySelector('.reaction-buttons');
    if (!reactionButtons) return;

    reactionButtons.innerHTML = `
        <button class="like-btn" onclick="handlePlayerReaction('like')" title="Like">
            <span class="material-symbols-outlined">thumb_up</span>
        </button>
        <button class="dislike-btn" onclick="handlePlayerReaction('dislike')" title="Dislike">
            <span class="material-symbols-outlined">thumb_down</span>
        </button>
    `;
}

function handlePlayerReaction(reactionType) {
    if (!currentVideoId) {
        showToast('No video is currently playing', 'error');
        return;
    }
    toggleVideoReaction(currentVideoId, reactionType);
}

// ========== INITIALIZE ON PAGE LOAD ========== //
document.addEventListener('DOMContentLoaded', function () {
    // ... existing code ...
    setupReactionButtons();
});
// // Track violation attempts
// let violationCount = 0;
// const MAX_VIOLATIONS = 5;

// function handleViolation(message, severity) {
//     violationCount++;
//     showToast(`${message} (${violationCount}/${MAX_VIOLATIONS})`, severity);

//     if (violationCount >= MAX_VIOLATIONS) {
//         enforceTermination();
//     }
// }

// function enforceTermination() {
//     // Try multiple methods to close/disable the page

//     // 1. First try standard window closing
//     try {
//         window.open('', '_self').close();
//     } catch (e) {}

//     // // 2. If that fails, redirect to about:blank after delay
//     // setTimeout(() => {
//     //     window.location.href = 'index.html';

//     //     // 3. As last resort, make page unusable
//     //     setTimeout(() => {
//     //         document.body.innerHTML = '<h1>Access Denied</h1>';
//     //         document.body.style.pointerEvents = 'none';
//     //         document.body.style.userSelect = 'none';

//     //         // Disable all keyboard input
//     //         document.addEventListener('keydown', (e) => {
//     //             e.preventDefault();
//     //             e.stopPropagation();
//     //             return false;
//     //         }, true);
//     //     }, 1000);
//     // }, 500);
// }

// // ===== Event Blockers =====
// document.addEventListener('contextmenu', (e) => {
//     e.preventDefault();
//     handleViolation('Right-click is disabled', 'warning');
//     return false;
// });

// document.addEventListener('keydown', (e) => {
//     // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+Shift+C
//     if (e.key === 'F12' || e.keyCode === 123 ||
//         (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
//         (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
//         (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
//         (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))) {
//         e.preventDefault();
//         handleViolation('Developer tools are disabled', 'error');
//         return false;
//     }
// });

// // ===== DevTools Detection =====
// let devToolsOpen = false;
// setInterval(() => {
//     const threshold = 160;
//     const widthThreshold = window.outerWidth - window.innerWidth > threshold;
//     const heightThreshold = window.outerHeight - window.innerHeight > threshold;

//     if ((widthThreshold || heightThreshold) && !devToolsOpen) {
//         devToolsOpen = true;
//         handleViolation('DevTools detected!', 'error');
//         window.location.href = 'about:blank';
//     } else if (!widthThreshold && !heightThreshold) {
//         devToolsOpen = false;
//     }
// }, 500);

// ===== Other Protections =====
window.addEventListener('beforeunload', (e) => {
    if (window.location.href.startsWith('view-source:')) {
        e.preventDefault();
        handleViolation('View Source blocked', 'error');
        window.location.href = '/';
        return false;
    }
});

document.addEventListener('dragstart', (e) => {
    e.preventDefault();
    handleViolation('Dragging disabled', 'warning');
    return false;
});

// FINAL FLOATING NOTES PANEL WITH TIMESTAMP
let notesPanelOpen = false;

function toggleNotesPanel() {
    const panel = document.getElementById("notes-panel");
    panel.classList.toggle("active");
    notesPanelOpen = !notesPanelOpen;
    if (notesPanelOpen && currentVideoId) {
        loadSavedNotes(currentVideoId);
        updateNotesBadge();
    }
}

function addTimestampToNote() {
    if (!player || !currentVideoId) return;
    const time = Math.floor(player.getCurrentTime());
    const mins = Math.floor(time / 60).toString().padStart(2, '0');
    const secs = (time % 60).toString().padStart(2, '0');
    const timestamp = `[${mins}:${secs}] `;

    const editor = document.getElementById("note-editor");
    editor.focus();
    document.execCommand('insertText', false, timestamp);
}
function seekToTime(seconds) {
    if (!player || typeof player.seekTo !== 'function') {
        showToast("Player not ready", "error");
        return;
    }

    player.seekTo(seconds);
    player.playVideo();
    showToast(`Jumped to ${formatTime(seconds)}`, "success");
}
// Helper to format seconds → 1:23
function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}
function format(cmd, val = null) {
    document.execCommand(cmd, false, val);
}

function addLink() {
    const url = prompt("Enter URL:");
    if (url) document.execCommand("createLink", false, url);
}

function saveCurrentNote() {
    const editor = document.getElementById("note-editor");
    const content = editor.innerHTML.trim();
    if (!content || content === '<br>') return showToast("Note is empty", "warning");

    const notes = JSON.parse(localStorage.getItem("mixify_notes") || "{}");
    if (!notes[currentVideoId]) notes[currentVideoId] = [];

    notes[currentVideoId].push({
        content: content,
        timestamp: Date.now()
    });

    localStorage.setItem("mixify_notes", JSON.stringify(notes));
    editor.innerHTML = "";
    loadSavedNotes(currentVideoId);
    updateNotesBadge();
    showToast("Note saved!", "success");
    updateAllNoteIndicators();  // ← ADD THIS
}

function loadSavedNotes(id) {
    const notes = JSON.parse(localStorage.getItem("mixify_notes") || "{}")[id] || [];
    const container = document.getElementById("saved-notes-list");

    container.innerHTML = notes.length === 0
        ? '<p style="text-align:center; color:#666; padding:30px;">No notes yet<br>Start taking notes while watching!</p>'
        : notes.map((n, i) => {
            // Extract first timestamp like [01:23] from note content
            const timeMatch = n.content.match(/\[(\d{1,4}):(\d{2})\]/);
            const hasTimestamp = timeMatch !== null;
            const minutes = hasTimestamp ? parseInt(timeMatch[1]) : 0;
            const seconds = hasTimestamp ? parseInt(timeMatch[2]) : 0;
            const totalSeconds = minutes * 60 + seconds;

            return `
                <div class="saved-note">
                    <div class="note-header">
                        <div class="timestamp">
                            ${new Date(n.timestamp).toLocaleString()}
                            ${hasTimestamp ? `
                                ` : ''}
                        </div>
                        <div class="notes_right">
                            <button class="delete-note" onclick="deleteNote('${id}', ${i})">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                            <button onclick="seekToTime(${totalSeconds})" class="play-timestamp-btn" title="Play from here">
                                <span class="material-symbols-outlined">play_arrow</span>
                            </button>
                        </div>
                    </div>
                    <hr>
                    <div class="content">${n.content}</div>
                </div>
            `;
        }).join("");
}

function deleteNote(id, i) {
    const notes = JSON.parse(localStorage.getItem("mixify_notes") || "{}");
    notes[id].splice(i, 1);
    if (notes[id].length === 0) delete notes[id];
    localStorage.setItem("mixify_notes", JSON.stringify(notes));
    loadSavedNotes(id);
    updateNotesBadge();
    updateAllNoteIndicators();  // ← ADD THIS
}

function updateNotesBadge() {
    const count = (JSON.parse(localStorage.getItem("mixify_notes") || "{}")[currentVideoId] || []).length;
    const badge = document.getElementById("notes-count-badge");
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
}
// Update ALL video cards with correct note count
function updateAllNoteIndicators() {
    const savedNotes = JSON.parse(localStorage.getItem('mixify_notes') || '{}');

    document.querySelectorAll('.stored-video').forEach(card => {
        const videoId = card.getAttribute('data-video-id');
        if (!videoId) return;

        const count = (savedNotes[videoId] || []).length;
        let badge = card.querySelector('.notes-indicator');

        if (count > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'notes-indicator';
                card.appendChild(badge);
            }
            badge.textContent = count;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.remove();
        }
    });

    // Also update floating button badge
    updateNotesBadge();
}

// GLOBAL NOTES INDICATOR — FINAL VERSION (Never disappears!)
let notesInterval = null;

function startNotesIndicatorUpdates() {
    // Clear any old interval
    if (notesInterval) clearInterval(notesInterval);

    // Update immediately + every 2 seconds
    const updateNowAndForever = () => {
        const savedNotes = JSON.parse(localStorage.getItem('mixify_notes') || '{}');

        document.querySelectorAll('.stored-video[data-video-id]').forEach(card => {
            const videoId = card.getAttribute('data-video-id');
            if (!videoId) return;

            const count = (savedNotes[videoId] || []).length;
            let badge = card.querySelector('.notes-indicator');

            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'notes-indicator';
                    card.style.position = 'relative';  // Critical for positioning
                    card.appendChild(badge);
                }
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else if (badge) {
                badge.remove();
            }
        });

        // Update floating button badge
        if (currentVideoId) {
            const count = (savedNotes[currentVideoId] || []).length;
            const badge = document.getElementById('notes-count-badge');
            if (badge) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.toggle('hidden', count === 0);
            }
        }
    };

    // Run immediately
    updateNowAndForever();

    // Then every 2 seconds
    notesInterval = setInterval(updateNowAndForever, 2000);
}

// START ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
    // Wait a tiny bit for Swiper/cards to render
    setTimeout(startNotesIndicatorUpdates, 800);

    // Also run after 3 seconds as backup
    setTimeout(startNotesIndicatorUpdates, 3000);
});
function refreshVideoCards() {
    // Your existing render code...
    // Then restart indicator updates
    setTimeout(startNotesIndicatorUpdates, 500);

}
