// DOM Elements
const titleScreen = document.getElementById('titleScreen');
const processingScreen = document.getElementById('processingScreen');
const resultsScreen = document.getElementById('resultsScreen');
const weeklyLogsScreen = document.getElementById('weeklyLogsScreen');

// Counters
const balutCount = document.getElementById('balutCount');
const penoyCount = document.getElementById('penoyCount');
const wetYolkCount = document.getElementById('wetYolkCount');

// Progress Elements
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

// Control Buttons
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
const stopBtn = document.getElementById('stopBtn');

// Chart references
let resultsChart = null;
let weeklyChart = null;

// Add state management for sorting process
let sortingState = {
    isPaused: false,
    isProcessing: false,
    currentBatch: [],
    batchSize: 5,
    processedEggs: 0,
    totalEggs: 0,
    intervalId: null,
    lastState: null
};

// Add date handling functions at the top after DOM Elements
let currentWeekStart = getWeekStart(new Date());

// Get current date in Philippines timezone (UTC+8)
function getCurrentDateInPH() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

// Get Monday of the current week
function getWeekStart(date) {
    // Ensure we're working with Philippines time
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    console.log('Current date (PH):', date);
    console.log('Calculated week start:', monday);
    return monday;
}

// Get Sunday of the current week
function getWeekEnd(weekStart) {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    console.log('Week end:', end);
    return end;
}

// Format date for storage
function formatDateForStorage(date) {
    // Ensure we're storing dates in Philippines timezone
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format date for display
function formatDateForDisplay(date) {
    const d = new Date(date);
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[d.getMonth()]} ${d.getDate()}`;
}

// Update date range display
function updateDateRange() {
    const weekEnd = getWeekEnd(currentWeekStart);
    const dateRange = document.getElementById('dateRange');
    const dateRangeMobile = document.getElementById('dateRange-mobile');
    if (dateRange && dateRangeMobile) {
        const startStr = formatDateForDisplay(currentWeekStart);
        const endStr = formatDateForDisplay(weekEnd);
        const dateText = `${startStr} - ${endStr}`;
        dateRange.textContent = dateText;
        dateRangeMobile.textContent = dateText;
        console.log('Date range updated:', dateText);
    }
}

// Navigate to previous week
function previousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateDateRange();
    updateWeeklyLogs();
}

// Navigate to next week
function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateDateRange();
    updateWeeklyLogs();
}

// Add event listeners for week navigation
document.getElementById('prevWeek').addEventListener('click', previousWeek);
document.getElementById('nextWeek').addEventListener('click', nextWeek);

// Initialize GSAP
gsap.config({ force3D: true });

// Initial title animation
window.addEventListener('load', () => {
    const title = document.querySelector('.animate-title');
    // Set initial state
    gsap.set(title, { opacity: 0, y: -50 });
    // Animate in
    gsap.to(title, {
        duration: 1,
        opacity: 1,
        y: 0,
        ease: 'power3.out'
    });
});

// Navigation Functions
function showScreen(screenToShow) {
    [titleScreen, processingScreen, resultsScreen, weeklyLogsScreen].forEach(screen => {
        screen.classList.add('hidden');
    });
    screenToShow.classList.remove('hidden');
    screenToShow.classList.add('section-enter');
}

// Button Event Listeners
document.getElementById('startSorting').addEventListener('click', startSorting);
document.getElementById('weeklyLogs').addEventListener('click', () => {
    showScreen(weeklyLogsScreen);
    updateWeeklyLogs();
});
document.getElementById('backToHome').addEventListener('click', () => {
    destroyCharts();
    showScreen(titleScreen);
});
document.getElementById('backToHomeFromLogs').addEventListener('click', () => {
    destroyCharts();
    showScreen(titleScreen);
});
document.getElementById('saveResults').addEventListener('click', saveResults);

// Delete Functions
document.getElementById('deleteLastEntry').addEventListener('click', deleteLastEntry);
document.getElementById('clearAllData').addEventListener('click', clearAllData);
document.getElementById('exportData').addEventListener('click', exportData);

// Add event listeners for control buttons
pauseResumeBtn.addEventListener('click', togglePause);
stopBtn.addEventListener('click', stopProcessing);

// Destroy existing charts
function destroyCharts() {
    if (resultsChart) {
        resultsChart.destroy();
        resultsChart = null;
    }
    if (weeklyChart) {
        weeklyChart.destroy();
        weeklyChart = null;
    }
}

// Save state to localStorage for recovery
function saveState() {
    sortingState.lastState = {
        processedEggs: sortingState.processedEggs,
        totalEggs: sortingState.totalEggs,
        balut: parseInt(balutCount.textContent),
        penoy: parseInt(penoyCount.textContent),
        wetYolk: parseInt(wetYolkCount.textContent),
        timestamp: Date.now()
    };
    localStorage.setItem('sortingState', JSON.stringify(sortingState.lastState));
}

// Recover from interrupted state
function recoverState() {
    const savedState = localStorage.getItem('sortingState');
    if (savedState) {
        const state = JSON.parse(savedState);
        // Check if the saved state is less than 1 hour old
        if (Date.now() - state.timestamp < 3600000) {
            if (confirm('Previous sorting session found. Would you like to resume?')) {
                sortingState.processedEggs = state.processedEggs;
                sortingState.totalEggs = state.totalEggs;
                balutCount.textContent = state.balut;
                penoyCount.textContent = state.penoy;
                wetYolkCount.textContent = state.wetYolk;
                updateProgress();
                showNotification('Previous session recovered', 'success');
                return true;
            }
        }
        localStorage.removeItem('sortingState');
    }
    return false;
}

// Update progress bar and status
function updateProgress() {
    const progress = (sortingState.processedEggs / sortingState.totalEggs) * 100;
    progressBar.style.width = `${progress}%`;
    statusText.textContent = `Processing egg ${sortingState.processedEggs} of ${sortingState.totalEggs}...`;
}

// Validate egg data
function validateEggData(eggType) {
    const validTypes = [0, 1, 2]; // 0: Balut, 1: Penoy, 2: Wet-Yolk Penoy
    if (!validTypes.includes(eggType)) {
        throw new Error('Invalid egg type detected');
    }
    
    // Check for unusual patterns
    const balut = parseInt(balutCount.textContent);
    const penoy = parseInt(penoyCount.textContent);
    const wetYolk = parseInt(wetYolkCount.textContent);
    const total = balut + penoy + wetYolk;
    
    // Alert if any type is more than 70% of total
    if (total > 10) {
        if (balut/total > 0.7) {
            showAlert('Unusual pattern: High number of Balut eggs detected');
        } else if (penoy/total > 0.7) {
            showAlert('Unusual pattern: High number of Penoy eggs detected');
        } else if (wetYolk/total > 0.7) {
            showAlert('Unusual pattern: High number of Wet-Yolk Penoy eggs detected');
        }
    }
    
    return true;
}

// Modified sorting process without automatic notification request
async function startSorting() {
    showScreen(processingScreen);
    
    // Check for recovery
    if (!recoverState()) {
        resetCounters();
        destroyCharts();
        sortingState.totalEggs = Math.floor(Math.random() * 20) + 10;
        sortingState.processedEggs = 0;
    }
    
    // Update initial status
    statusText.textContent = `Processing egg ${sortingState.processedEggs} of ${sortingState.totalEggs}...`;
    
    // Reset state
    sortingState.isPaused = false;
    sortingState.isProcessing = true;
    
    // Start processing
    try {
        await processBatch();
    } catch (error) {
        console.error('Error starting process:', error);
        showNotification('Error starting the sorting process', 'error');
    }
}

// Process eggs in batches
async function processBatch() {
    if (!sortingState.isProcessing) return;
    
    try {
        while (sortingState.processedEggs < sortingState.totalEggs) {
            if (sortingState.isPaused) {
                await new Promise(resolve => {
                    sortingState.intervalId = setInterval(() => {
                        if (!sortingState.isPaused) {
                            clearInterval(sortingState.intervalId);
                            resolve();
                        }
                    }, 100);
                });
            }
            
            // Process a batch of eggs
            const batchSize = Math.min(
                sortingState.batchSize,
                sortingState.totalEggs - sortingState.processedEggs
            );
            
            for (let i = 0; i < batchSize && !sortingState.isPaused; i++) {
                const eggType = Math.floor(Math.random() * 3);
                
                try {
                    if (validateEggData(eggType)) {
                        // Update counters
                        switch(eggType) {
                            case 0:
                                updateCounter(balutCount, parseInt(balutCount.textContent) + 1);
                                break;
                            case 1:
                                updateCounter(penoyCount, parseInt(penoyCount.textContent) + 1);
                                break;
                            case 2:
                                updateCounter(wetYolkCount, parseInt(wetYolkCount.textContent) + 1);
                                break;
                        }
                        sortingState.processedEggs++;
                        updateProgress();
                        saveState();
                        
                        // Add a small delay between eggs
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.error('Validation error:', error);
                    showNotification(error.message, 'error');
                }
            }
            
            // Add a small delay between batches
            if (!sortingState.isPaused) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Cleanup after completion
        localStorage.removeItem('sortingState');
        sortingState.isProcessing = false;
        await showResults();
        
        // Show completion notification
        showNotification('Sorting process completed successfully!', 'success');
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("EGGYFIER", {
                body: "Sorting process completed successfully!",
                icon: "/path/to/icon.png"
            });
        }
        
    } catch (error) {
        console.error('Error during sorting:', error);
        statusText.textContent = 'Error occurred during sorting. Click Resume to try again.';
        sortingState.isPaused = true;
        showNotification('Error during sorting process', 'error');
    }
}

// Stop processing function
function stopProcessing() {
    if (confirm('Are you sure you want to stop the sorting process?')) {
        sortingState.isProcessing = false;
        sortingState.isPaused = false;
        localStorage.removeItem('sortingState');
        showScreen(titleScreen);
        showNotification('Sorting process stopped', 'info');
    }
}

// Toggle pause/resume
function togglePause() {
    sortingState.isPaused = !sortingState.isPaused;
    
    // Update button text and icon
    const buttonSpan = pauseResumeBtn.querySelector('span');
    const buttonIcon = pauseResumeBtn.querySelector('svg path');
    
    if (sortingState.isPaused) {
        buttonSpan.textContent = 'Resume';
        buttonIcon.setAttribute('d', 'M8 5.14v14l11-7-11-7z'); // Play icon
    } else {
        buttonSpan.textContent = 'Pause';
        buttonIcon.setAttribute('d', 'M8 6h2v12H8V6zm6 0h2v12h-2V6z'); // Pause icon
    }
    
    statusText.textContent = sortingState.isPaused ? 'Process paused. Click Resume to continue...' : 
        `Processing egg ${sortingState.processedEggs} of ${sortingState.totalEggs}...`;
    
    showNotification(sortingState.isPaused ? 'Process paused' : 'Process resumed', 'info');
}

// Add backup reminder functionality
function setupBackupReminders() {
    // Check last backup date
    const lastBackup = localStorage.getItem('lastBackup');
    const now = Date.now();
    
    if (!lastBackup || now - parseInt(lastBackup) > 7 * 24 * 60 * 60 * 1000) { // 7 days
        showNotification('Please remember to backup your data', 'warning');
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("EGGYFIER Reminder", {
                body: "It's been a while since your last data backup. Please consider exporting your data.",
                icon: "/path/to/icon.png"
            });
        }
    }
}

// Modified export function with backup timestamp
function exportData() {
    const savedResults = JSON.parse(localStorage.getItem('eggyfierResults') || '[]');
    if (savedResults.length === 0) {
        showNotification('No data to export', 'error');
        return;
    }

    // Create CSV content
    const csvContent = [
        'Date,Time,Balut,Penoy,Wet-Yolk Penoy,Total',
        ...savedResults.map(entry => {
            const total = entry.balut + entry.penoy + entry.wetYolk;
            const date = formatDateForDisplay(new Date(entry.date));
            // Format time to 12-hour format with AM/PM
            let time = 'N/A';
            if (entry.time) {
                const timeParts = entry.time.split(':');
                if (timeParts.length >= 2) {
                    const hours = parseInt(timeParts[0]);
                    const minutes = timeParts[1].split(' ')[0];
                    const period = entry.time.includes('PM') ? 'PM' : 'AM';
                    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                    time = `${hours12}:${minutes} ${period}`;
                }
            }
            return `${date},${time},${entry.balut},${entry.penoy},${entry.wetYolk},${total}`;
        })
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const now = getCurrentDateInPH();
    const timestamp = now.toLocaleString('en-US', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(/[/:]/g, '-');
    link.download = `eggyfier_data_${timestamp}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    // Update backup timestamp
    localStorage.setItem('lastBackup', Date.now().toString());
    showNotification('Data exported successfully');
}

// Initialize backup reminders
document.addEventListener('DOMContentLoaded', () => {
    initializeCurrentWeek();
    setupBackupReminders();
    // Check backup reminder every day
    setInterval(setupBackupReminders, 24 * 60 * 60 * 1000);
});

// Counter Animation
function updateCounter(element, newValue) {
    element.textContent = newValue;
    element.classList.add('update');
    setTimeout(() => element.classList.remove('update'), 300);
}

// Reset Counters
function resetCounters() {
    balutCount.textContent = '0';
    penoyCount.textContent = '0';
    wetYolkCount.textContent = '0';
    progressBar.style.width = '0%';
    statusText.textContent = 'Initializing...';
}

// Show Results
async function showResults() {
    const balut = parseInt(balutCount.textContent);
    const penoy = parseInt(penoyCount.textContent);
    const wetYolk = parseInt(wetYolkCount.textContent);
    
    // Update totals
    document.getElementById('totalBalut').textContent = balut;
    document.getElementById('totalPenoy').textContent = penoy;
    document.getElementById('totalWetYolk').textContent = wetYolk;
    
    // Destroy existing chart if it exists
    destroyCharts();
    
    // Create new chart
    const ctx = document.getElementById('resultsChart').getContext('2d');
    resultsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Balut', 'Penoy', 'Wet-Yolk Penoy'],
            datasets: [{
                data: [balut, penoy, wetYolk],
                backgroundColor: [
                    '#d97706',
                    '#fbbf24',
                    '#fcd34d'
                ],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverBorderColor: '#ffffff',
                hoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            layout: {
                padding: 20
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    align: 'center',
                    labels: {
                        boxWidth: 10,
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
                            family: "'Poppins', sans-serif"
                        }
                    }
                }
            },
            elements: {
                arc: {
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }
            }
        }
    });
    
    showScreen(resultsScreen);
}

// Modified Save Results function
function saveResults() {
    const nowInPH = getCurrentDateInPH();
    
    // Format date in YYYY-MM-DD format
    const dateStr = formatDateForStorage(nowInPH);
    
    // Format time in 12-hour format with AM/PM
    const timeStr = nowInPH.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    
    const results = {
        date: dateStr,
        time: timeStr,
        balut: parseInt(balutCount.textContent),
        penoy: parseInt(penoyCount.textContent),
        wetYolk: parseInt(wetYolkCount.textContent)
    };
    
    console.log('Saving results:', results);
    
    // Get existing data
    const savedResults = JSON.parse(localStorage.getItem('eggyfierResults') || '[]');
    savedResults.push(results);
    
    // Save updated data
    localStorage.setItem('eggyfierResults', JSON.stringify(savedResults));
    
    showNotification('Results saved successfully', 'success');
}

// Process Weekly Data
function processWeeklyData(results) {
    const weeklyData = {
        dates: [],
        balut: Array(7).fill(0),
        penoy: Array(7).fill(0),
        wetYolk: Array(7).fill(0)
    };
    
    // Create array of all dates in the week
    const weekStart = currentWeekStart;
    console.log('Processing data for week starting:', weekStart);
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const dateStr = formatDateForStorage(currentDate);
        weeklyData.dates.push(dateStr);
        console.log(`Day ${i + 1}:`, dateStr);
    }
    
    // Filter and aggregate results for the current week
    results.forEach(entry => {
        const entryDate = new Date(entry.date);
        const entryDateStr = formatDateForStorage(entryDate);
        const dayIndex = weeklyData.dates.indexOf(entryDateStr);
        
        if (dayIndex !== -1) {
            console.log('Found entry for:', entryDateStr, entry);
            weeklyData.balut[dayIndex] += entry.balut || 0;
            weeklyData.penoy[dayIndex] += entry.penoy || 0;
            weeklyData.wetYolk[dayIndex] += entry.wetYolk || 0;
        }
    });
    
    console.log('Weekly data processed:', weeklyData);
    return weeklyData;
}

// Delete Functions
function deleteLastEntry() {
    if (confirm('Are you sure you want to delete the last entry?')) {
        const savedResults = JSON.parse(localStorage.getItem('eggyfierResults') || '[]');
        if (savedResults.length > 0) {
            savedResults.pop(); // Remove the last entry
            localStorage.setItem('eggyfierResults', JSON.stringify(savedResults));
            updateWeeklyLogs(); // Refresh the display
            showNotification('Last entry deleted successfully');
        } else {
            showNotification('No entries to delete', 'error');
        }
    }
}

function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        localStorage.removeItem('eggyfierResults');
        updateWeeklyLogs(); // Refresh the display
        showNotification('All data cleared successfully');
    }
}

function deleteSpecificEntry(date, time) {
    if (confirm('Are you sure you want to delete this entry?')) {
        const savedResults = JSON.parse(localStorage.getItem('eggyfierResults') || '[]');
        const entryIndex = savedResults.findIndex(entry => 
            entry.date === date && entry.time === time
        );
        
        if (entryIndex !== -1) {
            savedResults.splice(entryIndex, 1);
            localStorage.setItem('eggyfierResults', JSON.stringify(savedResults));
            updateWeeklyLogs(); // Refresh the display
            showNotification('Entry deleted successfully');
        }
    }
}

// Clear day data with proper date handling
function clearDayData(dateStr) {
    // Get current data
    const savedResults = JSON.parse(localStorage.getItem('eggyfierResults') || '[]');
    
    // Convert target date to YYYY-MM-DD format
    const targetDate = new Date(dateStr);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    console.log('Clearing data for date:', targetDateStr);
    console.log('Current data:', savedResults);
    
    if (confirm(`Are you sure you want to clear all entries for ${formatDateForDisplay(targetDate)}?`)) {
        // Filter out entries for the specified date
        const remainingResults = savedResults.filter(entry => {
            // Convert entry date to YYYY-MM-DD format for comparison
            const entryDate = new Date(entry.date);
            const entryDateStr = entryDate.toISOString().split('T')[0];
            
            // Log comparison
            console.log('Comparing:', entryDateStr, 'with', targetDateStr);
            
            // Keep entries that don't match the target date
            return entryDateStr !== targetDateStr;
        });
        
        console.log('Remaining data:', remainingResults);
        
        // Save the filtered results
        localStorage.setItem('eggyfierResults', JSON.stringify(remainingResults));
        
        // Force chart destruction and recreation
        if (weeklyChart) {
            weeklyChart.destroy();
            weeklyChart = null;
        }
        
        // Update the display
        updateWeeklyLogs();
        
        showNotification(`Data cleared for ${formatDateForDisplay(targetDate)}`, 'success');
    }
}

// Create a dedicated notifications container
document.addEventListener('DOMContentLoaded', () => {
    const notificationsContainer = document.createElement('div');
    notificationsContainer.id = 'notificationsContainer';
    notificationsContainer.className = 'fixed inset-0 pointer-events-none z-[10000] flex flex-col items-end justify-start p-4';
    document.body.appendChild(notificationsContainer);
});

// Modified notification system
function showNotification(message, type = 'success') {
    const notificationsContainer = document.getElementById('notificationsContainer');
    if (!notificationsContainer) return;

    const notification = document.createElement('div');
    notification.className = `pointer-events-auto rounded-lg shadow-lg p-4 m-2 text-white transform transition-all duration-300 opacity-0 notification ${type}`;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = 'rgba(16, 185, 129, 0.95)';
            break;
        case 'error':
            notification.style.backgroundColor = 'rgba(239, 68, 68, 0.95)';
            break;
        case 'warning':
            notification.style.backgroundColor = 'rgba(245, 158, 11, 0.95)';
            break;
        case 'info':
            notification.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
            break;
    }
    
    notification.textContent = message;
    notificationsContainer.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    });

    // Animate out and remove
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize tooltips
const tooltips = document.querySelectorAll('[data-tooltip]');
tooltips.forEach(tooltip => {
    tooltip.addEventListener('mouseenter', e => {
        const tip = document.createElement('div');
        tip.className = 'tooltip';
        tip.textContent = e.target.dataset.tooltip;
        document.body.appendChild(tip);
        
        const rect = e.target.getBoundingClientRect();
        tip.style.top = `${rect.top - tip.offsetHeight - 10}px`;
        tip.style.left = `${rect.left + (rect.width - tip.offsetWidth) / 2}px`;
    });
    
    tooltip.addEventListener('mouseleave', () => {
        const tip = document.querySelector('.tooltip');
        if (tip) tip.remove();
    });
});

// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const sunIcon = `<svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
</svg>`;
const moonIcon = `<svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
</svg>`;

// Always start in light mode
setTheme('light');

themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
});

function setTheme(theme) {
    htmlElement.setAttribute('data-theme', theme);
    themeToggle.innerHTML = theme === 'light' ? sunIcon : moonIcon;
    
    // Update colors based on theme
    if (theme === 'dark') {
        document.body.classList.remove('bg-gradient-to-br', 'from-amber-50', 'to-orange-100');
        document.body.classList.add('bg-gradient-to-br', 'from-gray-900', 'to-amber-900');
        
        // Update text colors for better visibility in dark mode
        document.querySelectorAll('.text-amber-800').forEach(el => {
            el.classList.remove('text-amber-800');
            el.classList.add('text-yellow-300');
        });
        
        document.querySelectorAll('.text-amber-700').forEach(el => {
            el.classList.remove('text-amber-700');
            el.classList.add('text-yellow-300');
        });
        
        document.querySelectorAll('.text-amber-600').forEach(el => {
            el.classList.remove('text-amber-600');
            el.classList.add('text-yellow-400');
        });

        // Update help modal text color in dark mode - only for text not in amber-50 background
        document.querySelectorAll('.space-y-6.text-gray-700 > div > p, .space-y-6.text-gray-700 > div > ol > li, .space-y-6.text-gray-700 > div > ul > li').forEach(el => {
            if (!el.closest('.bg-amber-50')) {
                el.style.setProperty('color', '#ffffff', 'important');
            }
        });

        // Update processing screen colors
        document.querySelector('#processingScreen h2').style.setProperty('color', '#3b82f6', 'important'); // Processing Eggs
        document.querySelectorAll('#processingScreen h3').forEach(el => {
            el.style.setProperty('color', '#3b82f6', 'important'); // Counter labels
        });
        document.querySelectorAll('#processingScreen .counter, #processingScreen .text-sm').forEach(el => {
            el.style.setProperty('color', '#60a5fa', 'important'); // Numbers and "Eggs processed"
        });
        document.getElementById('statusText').style.setProperty('color', '#93c5fd', 'important'); // Status text

        // Update weekly logs specific elements
        document.querySelectorAll('#dateRange, #prevWeek span, #nextWeek span').forEach(el => {
            el.style.setProperty('color', '#1e40af', 'important');
        });

        // Update Weekly Sorting Logs title and table headers specifically
        const weeklyTitle = document.querySelector('#weeklyLogsScreen h2');
        if (weeklyTitle) {
            weeklyTitle.style.setProperty('color', '#1e40af', 'important');
        }

        // Update results screen title and totals for dark mode
        document.querySelector('#resultsScreen h2').style.setProperty('color', '#1e40af', 'important');
        document.querySelectorAll('#resultsScreen h3, #resultsScreen p').forEach(el => {
            el.style.setProperty('color', '#1e40af', 'important');
        });

        // Update table headers and cells for dark mode
        document.querySelectorAll('table thead tr').forEach(tr => {
            tr.classList.remove('bg-yellow-200/70');
            tr.style.removeProperty('background-color');
            tr.classList.add('bg-yellow-200/70');
            
            tr.querySelectorAll('th').forEach(th => {
                th.classList.remove('text-gray-700');
                th.classList.add('text-blue-900');
                th.style.removeProperty('color');
            });
        });
        
        // Update card backgrounds
        document.querySelectorAll('.bg-white').forEach(el => {
            el.classList.remove('bg-white');
            el.classList.add('bg-gray-800');
        });
        
        // Update button colors
        document.querySelectorAll('.bg-amber-600').forEach(el => {
            el.classList.remove('bg-amber-600');
            el.classList.add('bg-amber-500');
        });
    } else {
        document.body.classList.remove('bg-gradient-to-br', 'from-gray-900', 'to-amber-900');
        document.body.classList.add('bg-gradient-to-br', 'from-amber-50', 'to-orange-100');
        
        // Revert text colors back to original
        document.querySelectorAll('.text-yellow-300').forEach(el => {
            if (el.classList.contains('text-lg') || el.classList.contains('text-3xl') || el.classList.contains('font-bold')) {
                el.classList.remove('text-yellow-300');
                el.classList.add('text-amber-800');
            } else {
                el.classList.remove('text-yellow-300');
                el.classList.add('text-amber-700');
            }
        });
        
        document.querySelectorAll('.text-yellow-400').forEach(el => {
            el.classList.remove('text-yellow-400');
            el.classList.add('text-amber-600');
        });

        // Revert help modal text color back to original - only for text not in amber-50 background
        document.querySelectorAll('.space-y-6.text-gray-700 > div > p, .space-y-6.text-gray-700 > div > ol > li, .space-y-6.text-gray-700 > div > ul > li').forEach(el => {
            if (!el.closest('.bg-amber-50')) {
                el.style.removeProperty('color');
            }
        });

        // Reset processing screen text colors for light mode
        document.querySelectorAll('#processingScreen h2, #processingScreen h3, #processingScreen .counter, #processingScreen .text-sm, #statusText').forEach(el => {
            el.style.removeProperty('color');
        });

        // Reset weekly logs specific elements
        document.querySelectorAll('#dateRange, #prevWeek span, #nextWeek span').forEach(el => {
            el.style.removeProperty('color');
        });

        // Reset Weekly Sorting Logs title
        const weeklyTitle = document.querySelector('#weeklyLogsScreen h2');
        if (weeklyTitle) {
            weeklyTitle.style.removeProperty('color');
        }

        // Reset results screen colors for light mode
        document.querySelector('#resultsScreen h2').style.removeProperty('color');
        document.querySelectorAll('#resultsScreen h3, #resultsScreen p').forEach(el => {
            el.style.removeProperty('color');
        });

        // Update table headers and cells for light mode
        document.querySelectorAll('table thead tr').forEach(tr => {
            tr.classList.remove('bg-slate-600/80');
            tr.classList.add('bg-yellow-200/70');
            tr.style.removeProperty('background-color');
            
            tr.querySelectorAll('th').forEach(th => {
                th.classList.remove('text-yellow-300');
                th.classList.add('text-blue-900');
                th.style.removeProperty('color');
            });
        });
        
        // Update card backgrounds
        document.querySelectorAll('.bg-gray-800').forEach(el => {
            el.classList.remove('bg-gray-800');
            el.classList.add('bg-white');
        });
        
        // Update button colors
        document.querySelectorAll('.bg-amber-500').forEach(el => {
            el.classList.remove('bg-amber-500');
            el.classList.add('bg-amber-600');
        });
    }

    // Refresh the weekly logs table if it's visible
    if (!document.getElementById('weeklyLogsScreen').classList.contains('hidden')) {
        updateWeeklyLogs();
    }
}

// Initialize particles.js
particlesJS('particles-js', {
    particles: {
        number: {
            value: 80,
            density: {
                enable: true,
                value_area: 800
            }
        },
        color: {
            value: '#d97706' // amber-600
        },
        shape: {
            type: 'circle'
        },
        opacity: {
            value: 0.1,
            random: false
        },
        size: {
            value: 3,
            random: true
        },
        line_linked: {
            enable: true,
            distance: 150,
            color: '#d97706',
            opacity: 0.1,
            width: 1
        },
        move: {
            enable: true,
            speed: 2,
            direction: 'none',
            random: false,
            straight: false,
            out_mode: 'out',
            bounce: false
        }
    },
    interactivity: {
        detect_on: 'canvas',
        events: {
            onhover: {
                enable: true,
                mode: 'grab'
            },
            onclick: {
                enable: true,
                mode: 'push'
            },
            resize: true
        },
        modes: {
            grab: {
                distance: 140,
                line_linked: {
                    opacity: 0.3
                }
            },
            push: {
                particles_nb: 4
            }
        }
    },
    retina_detect: true
});

// Add resize handler
window.addEventListener('resize', () => {
    if (weeklyChart) {
        weeklyChart.resize();
    }
});

// Update weekly logs display
function updateWeeklyLogs() {
    // Get saved results
    const savedResults = JSON.parse(localStorage.getItem('eggyfierResults') || '[]');
    console.log('Updating weekly logs with data:', savedResults);
    
    // Process data for the current week
    const weeklyData = processWeeklyData(savedResults);
    
    // Update date range display
    updateDateRange();
    
    // Create or update weekly chart
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (weeklyChart) {
        weeklyChart.destroy();
    }
    
    // Create new chart
    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeklyData.dates.map(date => formatDateForDisplay(new Date(date))),
            datasets: [
                {
                    label: 'Balut',
                    data: weeklyData.balut,
                    backgroundColor: '#d97706',
                    borderColor: '#d97706',
                    borderWidth: 1
                },
                {
                    label: 'Penoy',
                    data: weeklyData.penoy,
                    backgroundColor: '#fbbf24',
                    borderColor: '#fbbf24',
                    borderWidth: 1
                },
                {
                    label: 'Wet-Yolk Penoy',
                    data: weeklyData.wetYolk,
                    backgroundColor: '#fcd34d',
                    borderColor: '#fcd34d',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Update table with daily totals
    const tableBody = document.getElementById('weeklyLogsTable');
    if (!tableBody) {
        console.error('Table body not found!');
        return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Group data by date
    const dailyData = {};
    savedResults.forEach(entry => {
        const entryDate = new Date(entry.date);
        const dateStr = entryDate.toISOString().split('T')[0];
        
        // Check if date is within current week
        if (entryDate >= currentWeekStart && entryDate <= getWeekEnd(currentWeekStart)) {
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = {
                    balut: 0,
                    penoy: 0,
                    wetYolk: 0
                };
            }
            dailyData[dateStr].balut += entry.balut || 0;
            dailyData[dateStr].penoy += entry.penoy || 0;
            dailyData[dateStr].wetYolk += entry.wetYolk || 0;
        }
    });
    
    // Create table rows for each day in the week
    weeklyData.dates.forEach(date => {
        const data = dailyData[date] || { balut: 0, penoy: 0, wetYolk: 0 };
        const total = data.balut + data.penoy + data.wetYolk;
        
        const row = document.createElement('tr');
        const isDarkMode = htmlElement.getAttribute('data-theme') === 'dark';
        row.className = isDarkMode ? 'bg-slate-600/80 hover:bg-slate-500/80' : 'bg-white hover:bg-yellow-50';
        
        row.innerHTML = `
            <td class="px-4 py-2 text-center ${isDarkMode ? 'text-yellow-300' : 'text-gray-700'}">${formatDateForDisplay(new Date(date))}</td>
            <td class="px-4 py-2 text-center ${isDarkMode ? 'text-yellow-300' : 'text-gray-700'}">${data.balut}</td>
            <td class="px-4 py-2 text-center ${isDarkMode ? 'text-yellow-300' : 'text-gray-700'}">${data.penoy}</td>
            <td class="px-4 py-2 text-center ${isDarkMode ? 'text-yellow-300' : 'text-gray-700'}">${data.wetYolk}</td>
            <td class="px-4 py-2 text-center ${isDarkMode ? 'text-yellow-300' : 'text-gray-700'}">${total}</td>
            <td class="px-4 py-2 text-center">
                <button onclick="clearDayData('${date}')" 
                        class="text-red-500 hover:text-red-400 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Log table contents for debugging
    console.log('Table rows:', tableBody.children.length);
    console.log('Daily data:', dailyData);
}

// Initialize current week start
function initializeCurrentWeek() {
    const nowInPH = getCurrentDateInPH();
    currentWeekStart = getWeekStart(nowInPH);
    console.log('Initialized current week with PH date:', nowInPH);
    console.log('Week start set to:', currentWeekStart);
}

// Add a settings section to the title screen
document.addEventListener('DOMContentLoaded', () => {
    // Get the buttons from HTML
    const settingsButton = document.getElementById('settingsButton');
    const helpButton = document.getElementById('helpButton');
    const settingsModal = document.getElementById('settingsModal');
    const helpModal = document.getElementById('helpModal');
    
    // Add event listeners for settings and help buttons
    settingsButton.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    helpButton.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
    });
    
    // Setup notifications
    const toggleNotificationsBtn = document.getElementById('toggleNotifications');
    if (toggleNotificationsBtn) {
        // Update initial button text based on permission
        toggleNotificationsBtn.textContent = Notification.permission === "granted" ? "Disable" : "Enable";
        
        toggleNotificationsBtn.addEventListener('click', async () => {
            if (Notification.permission === "granted") {
                // Can't actually revoke permission, just update UI
                showNotification('Notifications can be disabled in your browser settings', 'info');
            } else {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                    toggleNotificationsBtn.textContent = "Disable";
                    showNotification('Notifications enabled', 'success');
                }
            }
        });
    }
    
    // Initialize other features
    initializeCurrentWeek();
    setupBackupReminders();
}); 