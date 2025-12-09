// script.js

import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firestore } from './firebase.js';

// --- Global State ---
const collectionName = 'requests';
const withdrawCollectionName = 'withdrawRequests';
let allFetchedDocs = []; 
let allWithdrawals = [];
let currentFilter = 'all';
let currentTab = 'requests';
const USERS = {
    admin: 'admin123',
    manager: 'manager123',
    viewer: 'viewer123'
};

// --- UI Element References ---
const docsContainer = document.getElementById('docs-container');
const statusMessage = document.getElementById('status-message');
const withdrawalsContainer = document.getElementById('withdrawals-container');
const withdrawalsMessage = document.getElementById('withdrawals-message');
const filterDropdown = document.getElementById('status-filter');
const modal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeModal = document.querySelector('.modal-close');
const loginOverlay = document.getElementById('login-overlay');
const loginPasswordInput = document.getElementById('login-password');
const loginUsernameInput = document.getElementById('login-username');
const loginSubmitButton = document.getElementById('login-submit');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');

// Chart instances
let statusChart = null;
let trendsChart = null;

/**
 * Initialize charts
 */
function initCharts() {
    const ctx1 = document.getElementById('statusChart');
    const ctx2 = document.getElementById('trendsChart');
    
    if (!ctx1 || !ctx2) return;
    
    // Destroy existing charts if they exist
    if (statusChart) statusChart.destroy();
    if (trendsChart) trendsChart.destroy();
    
    // Doughnut Chart for Status Overview
    statusChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'Paid/Approved', 'Rejected'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgba(245, 158, 11, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1
                }
            }
        }
    });
    
    // Bar Chart for Trends
    trendsChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Pending', 'Paid/Approved', 'Rejected'],
            datasets: [{
                label: 'Number of Requests',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(239, 68, 68, 0.7)'
                ],
                borderColor: [
                    'rgba(245, 158, 11, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 11, weight: '500' }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Update charts with current data
 */
function updateCharts() {
    if (!statusChart || !trendsChart) return;
    
    const dataSource = currentTab === 'requests' ? allFetchedDocs : allWithdrawals;
    
    const pending = dataSource.filter(item => item.data.payment_status === 'pending' || item.data.status === 'pending').length;
    const paid = dataSource.filter(item => item.data.payment_status === 'paid' || item.data.status === 'approved').length;
    const rejected = dataSource.filter(item => item.data.payment_status === 'proof_rejected' || item.data.status === 'rejected').length;
    
    // Update both charts
    statusChart.data.datasets[0].data = [pending, paid, rejected];
    statusChart.update('active');
    
    trendsChart.data.datasets[0].data = [pending, paid, rejected];
    trendsChart.update('active');
}

/**
 * Update statistics boxes with current data counts
 */
function updateStatistics() {
    const dataSource = currentTab === 'requests' ? allFetchedDocs : allWithdrawals;
    
    const total = dataSource.length;
    const pending = dataSource.filter(item => item.data.payment_status === 'pending' || item.data.status === 'pending').length;
    const paid = dataSource.filter(item => item.data.payment_status === 'paid' || item.data.status === 'approved').length;
    const rejected = dataSource.filter(item => item.data.payment_status === 'proof_rejected' || item.data.status === 'rejected').length;
    
    document.getElementById('total-count').textContent = total;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('paid-count').textContent = paid;
    document.getElementById('rejected-count').textContent = rejected;
    
    updateCharts();
}

/**
 * Helper function to safely format Firebase timestamps
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        let date;
        // Handle Firebase Timestamp object
        if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } 
        // Handle Firestore Timestamp toDate() method
        else if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        }
        // Handle regular Date object or timestamp string
        else {
            date = new Date(timestamp);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'N/A';
    }
}

/**
 * Renders documents to the UI based on the current filter.
 */
function renderDocs() {
    docsContainer.innerHTML = '';

    const filteredDocs = allFetchedDocs.filter(doc => {
        if (currentFilter === 'all') return true;
        return doc.data.payment_status === currentFilter;
    });

    if (filteredDocs.length === 0) {
        statusMessage.style.display = 'block';
        statusMessage.textContent = currentFilter === 'all' 
            ? 'No documents found in the collection.' 
            : `No documents match the filter "${currentFilter}".`;
        return;
    }
    statusMessage.style.display = 'none';

    filteredDocs.forEach(docItem => {
        const { id, data } = docItem;
        const status = data.payment_status || 'unknown';
        
        const card = document.createElement('div');
        // Add 'is-processed' class if status is not 'pending' to hide buttons via CSS
        card.className = `doc-card ${status !== 'pending' ? 'is-processed' : ''}`;
        card.dataset.docId = id;

        const price = data.acceptedPrice || data.payment_amount || 'N/A';
        const date = formatDate(data.payment_submitted_at);
        const statusText = status.replace('_', ' '); // 'proof_rejected' -> 'proof rejected'

        // --- NEW: Professional image handling ---
        const imageBlock = data.paymentProofUrl ? `
            <div class="card-image-container">
                <div class="image-loader"></div>
                <img src="${data.paymentProofUrl}" alt="Payment Proof" class="card-image" loading="lazy">
            </div>
        ` : `
            <div class="card-image-container">
                <div class="no-image-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <span>No Proof</span>
                </div>
            </div>
        `;
        
        // --- NEW: Action buttons block ---
        const actionsBlock = status === 'pending' ? `
            <div class="card-actions">
                <button class="action-button reject-button" data-doc-id="${id}" data-action="reject">Reject</button>
                <button class="action-button update-button" data-doc-id="${id}" data-action="approve">Mark as Paid</button>
            </div>
        ` : '<div class="card-actions"></div>'; // Empty div for smooth height transition

        card.innerHTML = `
            ${imageBlock}
            <div class="card-body">
                <div class="card-header">
                    <span class="doc-id">${id}</span>
                    <span class="status-badge status-${status}">${statusText}</span>
                </div>
                <div class="price">Rs. ${price}</div>
                <div class="details">
                    <div class="details-row">
                        <strong>Method:</strong> ${data.paymentMethod || 'N/A'}
                    </div>
                     <div class="details-row">
                        <strong>Submitted:</strong> ${date}
                    </div>
                </div>
                ${actionsBlock}
            </div>
        `;
        docsContainer.appendChild(card);
    });

    // Add load/error handlers for all new images
    document.querySelectorAll('.card-image').forEach(img => {
        const container = img.closest('.card-image-container');
        const loader = container.querySelector('.image-loader');
        if (loader) {
            img.onload = () => { loader.style.display = 'none'; };
            img.onerror = () => {
                loader.style.display = 'none';
                container.innerHTML = '<span>Image<br>Error</span>';
            };
        }
    });
    
    updateStatistics();
}

/**
 * Handles all status updates (approve, reject) with animations.
 */
async function handleStatusUpdate(docId, newStatus, cardElement) {
    const actionButtons = cardElement.querySelectorAll('.action-button');
    actionButtons.forEach(btn => btn.disabled = true);
    cardElement.querySelector('.update-button').textContent = 'Processing...';

    const docRef = doc(firestore, collectionName, docId);
    try {
        // If approving payment, also set order_status to 'started'
        const updateData = { payment_status: newStatus };
        if (newStatus === 'paid') {
            updateData.order_status = 'started';
        }
        
        await updateDoc(docRef, updateData);

        // --- Animate the UI Change ---
        const statusBadge = cardElement.querySelector('.status-badge');
        statusBadge.textContent = newStatus.replace('_', ' ');
        statusBadge.className = `status-badge status-${newStatus}`;
        cardElement.classList.add('is-processed'); // Triggers CSS to hide buttons

        // Update local data cache
        const docToUpdate = allFetchedDocs.find(doc => doc.id === docId);
        if (docToUpdate) {
            docToUpdate.data.payment_status = newStatus;
            if (newStatus === 'paid') {
                docToUpdate.data.order_status = 'started';
            }
        }

    } catch (error) {
        console.error("Error updating document: ", error);
        alert(`Failed to update status.`);
        actionButtons.forEach(btn => btn.disabled = false);
        cardElement.querySelector('.update-button').textContent = 'Mark as Paid';
    }
}

/**
 * Fetches all documents from Firebase ONCE and stores them.
 */
async function fetchAndStoreDocs() {
    try {
        const querySnapshot = await getDocs(collection(firestore, collectionName));
        allFetchedDocs = querySnapshot.docs
            .map(doc => ({
                id: doc.id,
                data: doc.data()
            }))
            // Filter out requests without payment proof and COD payments
            .filter(doc => {
                const data = doc.data;
                // Exclude if no payment proof URL exists
                if (!data.paymentProofUrl || data.paymentProofUrl.trim() === '') {
                    return false;
                }
                // Exclude if payment method is Cash on Delivery (COD)
                const paymentMethod = (data.paymentMethod || '').toLowerCase();
                if (paymentMethod === 'cod' || paymentMethod === 'cash on delivery' || paymentMethod === 'cashondelivery') {
                    return false;
                }
                return true;
            });
        
        allFetchedDocs.sort((a, b) => {
            const timeA = a.data.payment_submitted_at?.seconds || 0;
            const timeB = b.data.payment_submitted_at?.seconds || 0;
            return timeB - timeA;
        });
        
        renderDocs();
        
    } catch (error) {
        console.error("Error fetching documents: ", error);
        statusMessage.textContent = 'Failed to load documents. Check Firestore rules and console for errors.';
    }
}

// --- EVENT LISTENERS ---

filterDropdown.addEventListener('change', (event) => {
    currentFilter = event.target.value;
    renderDocs();
});

docsContainer.addEventListener('click', (event) => {
    const target = event.target;

    // Handle button clicks for status updates
    if (target.classList.contains('action-button')) {
        const docId = target.dataset.docId;
        const action = target.dataset.action;
        const cardElement = target.closest('.doc-card');
        
        if (action === 'approve') {
            handleStatusUpdate(docId, 'paid', cardElement);
        } else if (action === 'reject') {
            handleStatusUpdate(docId, 'proof_rejected', cardElement);
        }
    }

    // Handle image clicks to open modal
    if (target.classList.contains('card-image')) {
        modal.style.display = 'flex';
        modalImage.src = target.src;
    }
});

closeModal.addEventListener('click', () => modal.style.display = 'none');
modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

function showLogin() {
    loginOverlay.style.display = 'grid';
    loginOverlay.setAttribute('aria-hidden', 'false');
}

function hideLogin() {
    loginOverlay.style.display = 'none';
    loginOverlay.setAttribute('aria-hidden', 'true');
}

function isLoggedIn() {
    return localStorage.getItem('dashboard_logged_in') === 'true';
}

function setLoggedIn(val, username = '') {
    localStorage.setItem('dashboard_logged_in', val ? 'true' : 'false');
    if (val) localStorage.setItem('dashboard_user', username);
    else localStorage.removeItem('dashboard_user');
}

function tryLogin() {
    const username = (loginUsernameInput?.value || '').trim();
    const password = (loginPasswordInput?.value || '').trim();

    if (!username) {
        loginError.textContent = 'Please enter a username.';
        return;
    }
    if (!password) {
        loginError.textContent = 'Please enter a password.';
        return;
    }

    const expected = USERS[username];
    if (expected && expected === password) {
        setLoggedIn(true, username);
        loginError.textContent = '';
        hideLogin();
        fetchAndStoreDocs();
        fetchWithdrawals();
    } else {
        loginError.textContent = 'Invalid username or password.';
    }
}

function logout() {
    setLoggedIn(false);
    showLogin();
}

/**
 * Fetch all withdrawal requests from Firestore.
 */
async function fetchWithdrawals() {
    try {
        const querySnapshot = await getDocs(collection(firestore, withdrawCollectionName));
        allWithdrawals = querySnapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        }));
        
        allWithdrawals.sort((a, b) => {
            const timeA = a.data.createdAt?.seconds || 0;
            const timeB = b.data.createdAt?.seconds || 0;
            return timeB - timeA;
        });
        
        renderWithdrawals();
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        withdrawalsMessage.textContent = 'Failed to load withdrawals. Check Firestore rules and console.';
    }
}

/**
 * Render withdrawals to the UI.
 */
function renderWithdrawals() {
    withdrawalsContainer.innerHTML = '';

    if (allWithdrawals.length === 0) {
        withdrawalsMessage.style.display = 'block';
        withdrawalsMessage.textContent = 'No withdrawal requests found.';
        return;
    }
    withdrawalsMessage.style.display = 'none';

    allWithdrawals.forEach(withdrawItem => {
        const { id, data } = withdrawItem;
        const status = data.status || 'pending';
        const createdDate = formatDate(data.createdAt);

        const card = document.createElement('div');
        card.className = `withdraw-card ${status !== 'pending' ? 'is-processed' : ''}`;
        card.dataset.withdrawId = id;

        const actionsHTML = status === 'pending' ? `
            <div class="withdraw-actions">
                <button class="reject-btn" data-id="${id}" data-action="reject">Reject</button>
                <button class="approve-btn" data-id="${id}" data-action="approve">Approve</button>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="withdraw-field">
                <span class="withdraw-field-label">Seller Name</span>
                <span class="withdraw-field-value">${data.sellerName || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Email</span>
                <span class="withdraw-field-value">${data.sellerEmail || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Account Name</span>
                <span class="withdraw-field-value">${data.accountName || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Account No</span>
                <span class="withdraw-field-value">${data.accountNo || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Account IBAN</span>
                <span class="withdraw-field-value">${data.accountIban || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Bank Name</span>
                <span class="withdraw-field-value">${data.bankName || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Amount</span>
                <span class="withdraw-field-value">Rs. ${data.amount?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Commission</span>
                <span class="withdraw-field-value">Rs. ${data.commission?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Final Amount</span>
                <span class="withdraw-field-value">Rs. ${data.finalAmount?.toLocaleString() || 'N/A'}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Status</span>
                <span class="withdraw-status ${status}">${status}</span>
            </div>
            <div class="withdraw-field">
                <span class="withdraw-field-label">Created</span>
                <span class="withdraw-field-value">${createdDate}</span>
            </div>
            ${actionsHTML}
        `;
        withdrawalsContainer.appendChild(card);
    });
    
    updateStatistics();
}

/**
 * Update withdrawal status (pending -> approved/rejected).
 */
async function updateWithdrawalStatus(withdrawId, newStatus) {
    try {
        const docRef = doc(firestore, withdrawCollectionName, withdrawId);
        await updateDoc(docRef, { status: newStatus });
        
        const withdrawItem = allWithdrawals.find(w => w.id === withdrawId);
        if (withdrawItem) {
            withdrawItem.data.status = newStatus;
        }
        renderWithdrawals();
        alert(`Withdrawal status updated to ${newStatus}.`);
    } catch (err) {
        console.error('Error updating withdrawal:', err);
        alert('Failed to update status. Check console.');
    }
}



// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    
    // Hamburger menu toggle
    const hamburger = document.getElementById('hamburger-menu');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebar-close');
    
    if (hamburger && sidebar) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('active');
        });
    }
    
    // Sidebar close button
    if (sidebarClose && sidebar && hamburger) {
        sidebarClose.addEventListener('click', () => {
            sidebar.classList.remove('active');
            hamburger.classList.remove('active');
        });
    }
    
    // Sidebar navigation
    const sidebarNavItems = document.querySelectorAll('.sidebar .nav-item[data-tab]');
    sidebarNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.dataset.tab;
            
            // Update sidebar active state
            sidebarNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Switch tabs
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            const tabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
            if (tabButton) tabButton.classList.add('active');
            
            document.getElementById(`${tabName}-tab`).classList.add('active');
            currentTab = tabName;
            updateStatistics();
            
            // Close sidebar on mobile
            if (window.innerWidth <= 968) {
                sidebar.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });
    });
    
    // Analytics toggle from sidebar
    const navAnalytics = document.getElementById('nav-analytics');
    const chartsToggle = document.getElementById('charts-toggle');
    const analyticsIndicator = document.getElementById('analytics-indicator');
    
    if (navAnalytics && chartsToggle) {
        navAnalytics.addEventListener('click', (e) => {
            e.preventDefault();
            chartsToggle.checked = !chartsToggle.checked;
            chartsToggle.dispatchEvent(new Event('change'));
            analyticsIndicator.textContent = chartsToggle.checked ? 'ON' : 'OFF';
            analyticsIndicator.style.background = chartsToggle.checked 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
        });
    }
    
    // Sidebar logout button
    const sidebarLogout = document.getElementById('sidebar-logout');
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', logout);
    }
    
    // Charts toggle functionality
    const chartsContainer = document.getElementById('charts-container');
    
    if (chartsToggle && chartsContainer) {
        chartsToggle.addEventListener('change', function() {
            if (this.checked) {
                chartsContainer.classList.remove('collapsed');
                if (analyticsIndicator) {
                    analyticsIndicator.textContent = 'ON';
                    analyticsIndicator.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                }
            } else {
                chartsContainer.classList.add('collapsed');
                if (analyticsIndicator) {
                    analyticsIndicator.textContent = 'OFF';
                    analyticsIndicator.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
                }
            }
        });
    }
    
    if (isLoggedIn()) {
        hideLogin();
        fetchAndStoreDocs();
        fetchWithdrawals();
    } else {
        showLogin();
    }
});

// --- Tab Switching ---
document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        currentTab = tabName;
        
        updateStatistics();
    });
});

// --- Login Events ---
loginSubmitButton?.addEventListener('click', tryLogin);
loginPasswordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
});
loginUsernameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
});
logoutButton?.addEventListener('click', logout);

// --- Withdrawal Actions ---
withdrawalsContainer?.addEventListener('click', (e) => {
    if (e.target.classList.contains('approve-btn')) {
        const withdrawId = e.target.dataset.id;
        updateWithdrawalStatus(withdrawId, 'approved');
    } else if (e.target.classList.contains('reject-btn')) {
        const withdrawId = e.target.dataset.id;
        updateWithdrawalStatus(withdrawId, 'rejected');
    }
});