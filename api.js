// Constants
        const API_BASE_URL = 'https://clipscollegebackend.vercel.app'; // Uses current server origin
        const ADMIN_TOKEN_KEY = 'adminToken';
        const ADMIN_DATA_KEY = 'adminData';

        // Utility functions
        const showElement = (element) => element.style.display = 'block';
        const hideElement = (element) => element.style.display = 'none';
        const $ = (id) => document.getElementById(id);

        // Student data management
        let studentsData = [];
        let currentPage = 1;
        const pageSize = 10;
        let sortField = 'name';
        let sortDirection = 'asc';
        
        // Toast notification system
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            // Icons based on notification type
            let icon = '';
            switch(type) {
                case 'success':
                    icon = '<i class="fas fa-check-circle" style="color: var(--success-color); font-size: 1.2rem; margin-right: 10px;"></i>';
                    break;
                case 'error':
                    icon = '<i class="fas fa-exclamation-circle" style="color: var(--error-color); font-size: 1.2rem; margin-right: 10px;"></i>';
                    break;
                case 'warning':
                    icon = '<i class="fas fa-exclamation-triangle" style="color: var(--warning-color); font-size: 1.2rem; margin-right: 10px;"></i>';
                    break;
                default:
                    icon = '<i class="fas fa-info-circle" style="color: var(--secondary-color); font-size: 1.2rem; margin-right: 10px;"></i>';
            }
            
            toast.innerHTML = `
                <div style="display: flex; align-items: center;">
                    ${icon}
                    <div style="font-weight: 600; font-size: 1rem;">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                    <div style="margin-left: auto; cursor: pointer;" onclick="this.parentElement.parentElement.remove()">
                        <i class="fas fa-times" style="color: #888; font-size: 0.9rem;"></i>
                    </div>
                </div>
                <div style="margin-top: 8px; margin-left: 32px; font-size: 0.95rem; line-height: 1.5;">${message}</div>
            `;
            
            $('toastContainer').appendChild(toast);
            
            // Auto dismiss after 5 seconds
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(120%)';
                setTimeout(() => toast.remove(), 400);
            }, 5000);
        }

        // Status message helper
        function showStatus(elementId, message, type = 'success') {
            const statusEl = $(elementId);
            
            // Add appropriate icon based on type
            let icon = '';
            switch(type) {
                case 'success':
                    icon = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i>';
                    break;
                case 'error':
                    icon = '<i class="fas fa-times-circle" style="margin-right: 8px;"></i>';
                    break;
                case 'warning':
                    icon = '<i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>';
                    break;
            }
            
            statusEl.innerHTML = icon + message;
            statusEl.className = `status-message ${type}`;
            showElement(statusEl);
            
            // Animate and hide after 5 seconds
            setTimeout(() => {
                statusEl.style.opacity = '0';
                setTimeout(() => hideElement(statusEl), 500);
            }, 5000);
        }

        // Loading state management
        function setLoadingState(buttonId, isLoading, text = '') {
            const btn = $(buttonId);
            if (!btn) return;
            
            const btnText = btn.querySelector('.btn-text') || btn.querySelector('span');
            const icon = btn.querySelector('i:not(.spinner)');
            
            if (isLoading) {
                btn.disabled = true;
                if (icon) icon.style.display = 'none';
                if (btnText) {
                    btnText.innerHTML = '<div class="spinner"></div><span style="margin-left: 5px;">Processing...</span>';
                } else {
                    btn.innerHTML = '<div class="spinner"></div><span style="margin-left: 5px;">Processing...</span>';
                }
                btn.classList.add('processing');
                btn.style.opacity = '0.85';
            } else {
                btn.disabled = false;
                if (icon) icon.style.display = 'inline-block';
                if (btnText) {
                    btnText.textContent = text || btnText.textContent.replace('Processing...', '').trim();
                } else if (text) {
                    btn.textContent = text;
                }
                btn.classList.remove('processing');
                btn.style.opacity = '1';
            }
        }

        // Debug logging utility
        function debugLog(message, data) {
            const DEBUG = true; // Set to false in production
            if (DEBUG) {
                console.log(`%c${message}`, 'color: #0066ff; font-weight: bold;', data);
            }
        }

        // API request helper with better error handling
        async function apiRequest(url, options = {}) {
            try {
                debugLog(`API Request to ${url}`, { method: options.method || 'GET' });
                
                const token = localStorage.getItem(ADMIN_TOKEN_KEY);
                const isFormData = options.body instanceof FormData;
                const isBinaryFile = options.body instanceof File;
                
                // Clone the options to avoid modifying the original
                const fetchOptions = { ...options };
                
                // Initialize headers
                fetchOptions.headers = { ...options.headers } || {};
                
                // Add authorization token if available
                if (token) {
                    fetchOptions.headers['Authorization'] = `Bearer ${token}`;
                }
                
                // Accept JSON responses
                fetchOptions.headers['Accept'] = 'application/json';
                
                // Handle different upload types
                if (isFormData) {
                    // For FormData, DO NOT set Content-Type header - let the browser handle it with the proper boundary
                    delete fetchOptions.headers['Content-Type'];
                    
                    debugLog(`Sending FormData to ${url}`, {
                        fields: [...options.body.keys()],
                        method: options.method || 'GET',
                        fileFields: [...options.body.keys()].filter(key => {
                            const value = options.body.get(key);
                            return value instanceof File || value instanceof Blob;
                        }).map(key => ({
                            key,
                            fileName: options.body.get(key).name,
                            fileType: options.body.get(key).type,
                            fileSize: options.body.get(key).size
                        }))
                    });
                } else if (isBinaryFile) {
                    // For binary file uploads, keep the Content-Type set by the caller
                    // The Content-Type should already be set in the request options
                    
                    debugLog(`Sending binary file to ${url}`, {
                        fileName: options.body.name,
                        fileType: options.body.type,
                        fileSize: `${(options.body.size / 1024).toFixed(2)} KB`,
                        method: options.method || 'GET',
                        contentType: fetchOptions.headers['Content-Type']
                    });
                } else if (!fetchOptions.headers['Content-Type']) {
                    // For non-file requests, set Content-Type to application/json if not set
                    fetchOptions.headers['Content-Type'] = 'application/json';
                }
                
                const response = await fetch(`${API_BASE_URL}${url}`, fetchOptions);

                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                let data;
                
                debugLog(`API Response status: ${response.status}`, { 
                    contentType,
                    url,
                    method: options.method || 'GET'
                });
                
                try {
                    // Try JSON first if content type suggests JSON
                    if (contentType && contentType.includes('application/json')) {
                        data = await response.json();
                        debugLog('API Response data (JSON):', data);
                    } else {
                        // If not JSON, get text
                        const text = await response.text();
                        debugLog('API Response text:', text);
                        
                        // Try to parse as JSON anyway in case Content-Type is wrong
                        if (text && text.trim() && (text.startsWith('{') || text.startsWith('['))) {
                            try {
                                data = JSON.parse(text);
                                debugLog('Parsed text response as JSON:', data);
                            } catch (parseError) {
                                // Not valid JSON after all
                                data = { error: text || `HTTP ${response.status}: ${response.statusText}` };
                            }
                        } else {
                            // Plain text response
                            data = { error: text || `HTTP ${response.status}: ${response.statusText}` };
                        }
                    }
                } catch (parseError) {
                    debugLog('Error parsing response:', parseError.message);
                    data = { 
                        error: `Failed to parse server response: ${parseError.message}`,
                        status: response.status
                    };
                }
                
                if (!response.ok) {
                    // Check if the error is in a structured format
                    if (data && data.error) {
                        let errorMessage = data.error;
                        // If there are details, append them
                        if (data.details) {
                            errorMessage += `: ${data.details}`;
                        }
                        // If there's help text, log it
                        if (data.help) {
                            console.log(`API Error Help: ${data.help}`);
                            debugLog('API Error Help:', data.help);
                        }
                        
                        // Special handling for form data errors
                        if (errorMessage.includes('FormData') && options.body instanceof FormData) {
                            console.log('FormData parsing error details:', new Error(errorMessage));
                            debugLog('FormData contents:', {
                                fieldCount: [...options.body.keys()].length,
                                fields: [...options.body.keys()],
                                hasFiles: [...options.body.values()].some(v => v instanceof File)
                            });
                        }
                        
                        throw new Error(errorMessage);
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${data ? JSON.stringify(data) : ''}`);
                    }
                }

                return { success: true, data };
            } catch (error) {
                console.error('API Request failed:', error);
                
                // Enhanced error handling with more specific messages
                let errorMessage = error.message;
                
                if (error.message.includes('FormData')) {
                    console.log('FormData parsing error details:', error);
                    errorMessage = 'Error with file upload format. Please try again with a different file or contact support.';
                } else if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Network error. Please check your connection.';
                } else if (error.message.includes('500')) {
                    errorMessage = 'Server error. The operation could not be completed. The server team has been notified.';
                } else if (error.message.includes('400') && options.body instanceof FormData) {
                    errorMessage = 'Error with file upload. The server could not process your file.';
                    console.log('Form data upload error:', error);
                } else if (error.message.includes('404')) {
                    errorMessage = 'Resource not found. Please check the URL and try again.';
                } else if (error.message.includes('401')) {
                    errorMessage = 'Authentication error. Please log in again.';
                    // If authentication error, clear token
                    localStorage.removeItem(ADMIN_TOKEN_KEY);
                }
                
                return { 
                    success: false, 
                    error: errorMessage,
                    originalError: error.message
                };
            }
        }        // Student management functions
        async function fetchStudents() {
            // Show loading state
            const tableContainer = $('studentsTableContainer');
            if (tableContainer) {
                tableContainer.innerHTML = `
                <div class="table-loading">
                    <div class="spinner" style="width: 30px; height: 30px;"></div>
                    <div>Loading students...</div>
                </div>`;
            }
            
            try {
                // Use apiRequest helper instead of direct fetch to ensure consistent error handling
                const result = await apiRequest('/students');
                
                if (result.success) {
                    // Check if the response is an array or has a data property
                    const data = Array.isArray(result.data) ? result.data : 
                             (result.data.students || result.data);
                    
                    if (Array.isArray(data)) {
                        // Map status field since it's not in the API response
                        studentsData = data.map(student => ({
                            ...student,
                            status: student.status || 'active' // Use existing status or default to active
                        }));
                        showToast(`${studentsData.length} students loaded successfully`, 'success');
                    } else {
                        console.warn('Unexpected data format:', result.data);
                        studentsData = getSampleStudentData();
                        showToast('Unable to parse student data, using sample data instead', 'warning');
                    }
                } else {
                    // If API request fails, use sample data for demonstration
                    console.warn('API request failed:', result.error);
                    studentsData = getSampleStudentData();
                    showToast('Using sample data for demonstration', 'info');
                }
            } catch (error) {
                console.error('Error fetching students:', error);
                // Use sample data as fallback
                studentsData = getSampleStudentData();
                showToast('Using sample data for demonstration', 'info');
            }
            
            // Initially sort by name
            sortStudents('name');
            // Reset filters
            if ($('studentSearch')) $('studentSearch').value = '';
            if ($('statusFilter')) $('statusFilter').value = 'all';
        }
          // Sample data function when no backend is available
        function getSampleStudentData() {
            return [
                {
                    id: "549d348e-07ce-475a-95de-af122f9a6e78",
                    registration_number: "STU20256331",
                    name: "Test Student",
                    course: "Computer Science",
                    level_of_study: "Year 1 Semester 1",
                    photo_url: null,
                    national_id: "12345678",
                    birth_certificate: null,
                    date_of_birth: "2006-01-20T00:00:00.000Z",
                    status: "active"
                },
                {
                    id: "e63ef8d4-755c-4f71-8b36-748f75469768",
                    registration_number: "STU20256332",
                    name: "Sample Student",
                    course: "Business Administration",
                    level_of_study: "Undergraduate",
                    photo_url: null,
                    national_id: "87654321",
                    birth_certificate: "BC54321",
                    date_of_birth: "2001-05-15T00:00:00.000Z",
                    status: "active"
                },
                {
                    id: "f72a3b8c-9d4e-5f6a-7b8c-9d0e1f2a3b4c",
                    registration_number: "STU20256333",
                    name: "John Doe",
                    course: "Computer Engineering",
                    level_of_study: "Year 2 Semester 1",
                    photo_url: null,
                    national_id: "23456789",
                    birth_certificate: null,
                    date_of_birth: "2004-03-10T00:00:00.000Z",
                    status: "active"
                },
                {
                    id: "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
                    registration_number: "STU20256334",
                    name: "Jane Smith",
                    course: "Electrical Engineering",
                    level_of_study: "Year 3 Semester 2",
                    photo_url: null,
                    national_id: "34567890",
                    birth_certificate: "BC67890",
                    date_of_birth: "2002-07-22T00:00:00.000Z",
                    status: "on-leave"
                },
                {
                    id: "q7r8s9t0-u1v2-w3x4-y5z6-a7b8c9d0e1f2",
                    registration_number: "STU20256335",
                    name: "Robert Johnson",
                    course: "Mechanical Engineering",
                    level_of_study: "Year 4 Semester 1",
                    photo_url: null,
                    national_id: "45678901",
                    birth_certificate: null,
                    date_of_birth: "2000-11-05T00:00:00.000Z",
                    status: "inactive"
                }
            ];
        }
        
        // Search students by name or registration number
        function searchStudents(query) {
            if (!query.trim()) {
                // If search is cleared, reset to showing all students with current filter
                filterStudents();
                return;
            }
            
            const statusFilter = $('statusFilter').value;
            query = query.toLowerCase().trim();
            
            const filtered = studentsData.filter(student => {
                const matchesSearch = (student.name && student.name.toLowerCase().includes(query)) || 
                                     (student.registration_number && student.registration_number.toLowerCase().includes(query));
                                     
                const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
                
                return matchesSearch && matchesStatus;
            });
            
            renderFilteredStudents(filtered);
        }
        
        // Filter students by status
        function filterStudents() {
            const statusFilter = $('statusFilter').value;
            const searchQuery = $('studentSearch').value.toLowerCase().trim();
            
            if (statusFilter === 'all' && !searchQuery) {
                // If no filters applied, show all students
                currentPage = 1;
                renderStudentsTable();
                return;
            }
            
            const filtered = studentsData.filter(student => {
                const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
                const matchesSearch = !searchQuery || 
                                     (student.name && student.name.toLowerCase().includes(searchQuery)) || 
                                     (student.registration_number && student.registration_number.toLowerCase().includes(searchQuery));
                
                return matchesStatus && matchesSearch;
            });
            
            renderFilteredStudents(filtered);
        }
        
        // Render filtered students results
        function renderFilteredStudents(filteredData) {
            const tableContainer = $('studentsTableContainer');
            if (!tableContainer) return;
            
            if (!filteredData.length) {
                tableContainer.innerHTML = `
                <div class="table-empty">
                    <i class="fas fa-search" style="font-size: 40px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <h3>No Matching Students</h3>
                    <p>No students match your search criteria. Try adjusting your filters.</p>
                </div>`;
                return;
            }
            
            // Store current sort settings
            const currentSortField = sortField;
            const currentSortDirection = sortDirection;
            
            // Temporarily replace students data with filtered results
            const originalData = studentsData;
            studentsData = filteredData;
            
            // Reset to page 1 for new filter/search
            currentPage = 1;
            
            // Sort filtered data with current sort settings
            sortField = currentSortField;
            sortDirection = currentSortDirection;
            sortStudents(sortField);
            
            // Restore original data
            studentsData = originalData;
        }

        // Sort students data
        function sortStudents(field) {
            if (sortField === field) {
                // Toggle direction if clicking the same field
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // Default to ascending for a new sort field
                sortField = field;
                sortDirection = 'asc';
            }
            
            studentsData.sort((a, b) => {
                // Handle cases where field might be undefined
                const aVal = a[field] !== undefined ? a[field] : '';
                const bVal = b[field] !== undefined ? b[field] : '';
                
                // Case insensitive string comparison
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortDirection === 'asc' 
                        ? aVal.localeCompare(bVal) 
                        : bVal.localeCompare(aVal);
                }
                
                // Number comparison
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            });
            
            renderStudentsTable();
        }

        // Handle pagination
        function handlePagination(newPage) {
            currentPage = newPage;
            renderStudentsTable();
            // Scroll to top of table
            $('viewStudentsCard').scrollIntoView({ behavior: 'smooth' });
        }        // Render students table with current data, sorting, and pagination
        function renderStudentsTable() {
            const tableContainer = $('studentsTableContainer');
            if (!tableContainer) return;
            
            if (!studentsData.length) {
                tableContainer.innerHTML = `
                <div class="table-empty">
                    <i class="fas fa-users-slash" style="font-size: 40px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <h3>No Students Found</h3>
                    <p>There are currently no students registered in the system.</p>
                </div>`;
                return;
            }
            
            // Calculate pagination
            const totalPages = Math.ceil(studentsData.length / pageSize);
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, studentsData.length);
            const currentStudents = studentsData.slice(startIndex, endIndex);
            
            // Generate table HTML
            let tableHTML = `
            <div class="table-wrapper">
                <table class="students-table">
                    <thead>
                        <tr>
                            <th>Photo</th>
                            <th class="sortable ${sortField === 'name' ? 'sorted-' + sortDirection : ''}" onclick="sortStudents('name')">
                                Student Name <i class="fas fa-sort"></i>
                            </th>
                            <th class="sortable ${sortField === 'registration_number' ? 'sorted-' + sortDirection : ''}" onclick="sortStudents('registration_number')">
                                Reg Number <i class="fas fa-sort"></i>
                            </th>
                            <th class="sortable ${sortField === 'course' ? 'sorted-' + sortDirection : ''}" onclick="sortStudents('course')">
                                Course <i class="fas fa-sort"></i>
                            </th>
                            <th class="sortable ${sortField === 'level_of_study' ? 'sorted-' + sortDirection : ''}" onclick="sortStudents('level_of_study')">
                                Level of Study <i class="fas fa-sort"></i>
                            </th>
                            <th class="sortable ${sortField === 'status' ? 'sorted-' + sortDirection : ''}" onclick="sortStudents('status')">
                                Status <i class="fas fa-sort"></i>
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>`;
                    
            currentStudents.forEach(student => {
                // Generate initials for placeholder if no photo
                const nameParts = (student.name || '').split(' ');
                const initials = nameParts.length > 1 
                    ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() 
                    : (nameParts[0] ? nameParts[0][0].toUpperCase() : '?');
                
                // Display national ID or birth certificate in tooltip
                const identificationInfo = student.national_id ? 
                    `National ID: ${student.national_id}` : 
                    student.birth_certificate ? 
                    `Birth Certificate: ${student.birth_certificate}` : '';
                
                // Format date of birth if available
                let dateOfBirth = '';
                if (student.date_of_birth) {
                    const dob = new Date(student.date_of_birth);
                    dateOfBirth = dob.toLocaleDateString('en-US', {
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric'
                    });
                }
                
                // Determine status class - use active as default if no status is provided
                const status = student.status || 'active';
                const statusClass = status === 'active' ? 'active' 
                    : status === 'on-leave' ? 'on-leave' 
                    : 'inactive';
                
                tableHTML += `
                <tr>
                    <td>
                        ${student.photo_url 
                            ? `<img src="${student.photo_url}" alt="${student.name}" class="student-photo">` 
                            : `<div class="student-photo-placeholder" title="${dateOfBirth ? 'DOB: ' + dateOfBirth : ''}">${initials}</div>`
                        }
                    </td>
                    <td title="${identificationInfo}">${student.name || 'N/A'}</td>
                    <td>${student.registration_number || 'N/A'}</td>
                    <td>${student.course || 'N/A'}</td>
                    <td>${student.level_of_study || 'N/A'}</td>
                    <td>
                        <span class="student-status ${statusClass}">${status}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="viewStudentDetails('${student.registration_number}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="action-btn edit" onclick="editStudent('${student.registration_number}')">
                                <i class="fas fa-pen"></i> Edit
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
            
            tableHTML += `
                    </tbody>
                </table>
            </div>
            
            <div class="table-pagination">
                <div class="pagination-info">
                    Showing ${startIndex + 1} to ${endIndex} of ${studentsData.length} students
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="handlePagination(1)">
                        <i class="fas fa-angle-double-left"></i>
                    </button>
                    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="handlePagination(${currentPage - 1})">
                        <i class="fas fa-angle-left"></i>
                    </button>
                    
                    <span style="margin: 0 10px; color: var(--text-primary);">Page ${currentPage} of ${totalPages}</span>
                    
                    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="handlePagination(${currentPage + 1})">
                        <i class="fas fa-angle-right"></i>
                    </button>
                    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="handlePagination(${totalPages})">
                        <i class="fas fa-angle-double-right"></i>
                    </button>
                </div>
            </div>`;
            
            tableContainer.innerHTML = tableHTML;
        }        // Student detail view function
        function viewStudentDetails(regNumber) {
            // Find the student in the data
            const student = studentsData.find(s => s.registration_number === regNumber);
            
            if (!student) {
                showToast(`Student with registration number ${regNumber} not found.`, 'error');
                return;
            }
            
            // Format the date of birth
            let formattedDOB = 'Not provided';
            if (student.date_of_birth) {
                try {
                    const dob = new Date(student.date_of_birth);
                    if (!isNaN(dob.getTime())) { // Check if date is valid
                        formattedDOB = dob.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                } catch (e) {
                    console.warn('Invalid date format:', student.date_of_birth);
                }
            }
            
            // Generate initials safely
            let initials = '??';
            try {
                if (student.name) {
                    const nameParts = student.name.split(' ');
                    initials = nameParts.length > 1 
                        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() 
                        : (nameParts[0] ? nameParts[0][0].toUpperCase() : '?');
                }
            } catch (e) {
                console.warn('Error generating initials:', e);
            }
            
            // Create a modal to display student details
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Student Details</h2>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="student-profile">
                            <div class="student-avatar">
                                ${student.photo_url 
                                    ? `<img src="${student.photo_url}" alt="${student.name || 'Student'}" class="large-photo">` 
                                    : `<div class="large-photo-placeholder">${initials}</div>`
                                }
                            </div>
                            <div class="student-info">
                                <h3>${student.name || 'No Name'}</h3>
                                <p class="student-meta"><strong>Registration:</strong> ${student.registration_number || 'N/A'}</p>
                                <p class="student-meta"><strong>Course:</strong> ${student.course || 'Not specified'}</p>
                                <p class="student-meta"><strong>Level:</strong> ${student.level_of_study || 'Not specified'}</p>
                                <span class="student-status ${student.status || 'active'}">${student.status || 'Active'}</span>
                            </div>
                        </div>
                        
                        <div class="details-section">
                            <h4>Personal Information</h4>
                            <div class="details-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Date of Birth:</span>
                                    <span class="detail-value">${formattedDOB}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">National ID:</span>
                                    <span class="detail-value">${student.national_id || 'Not provided'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Birth Certificate:</span>
                                    <span class="detail-value">${student.birth_certificate || 'Not provided'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Student ID:</span>
                                    <span class="detail-value">${student.id || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" id="closeModalBtn">Close</button>
                        <button class="btn btn-primary" id="editStudentBtn">
                            <i class="fas fa-edit"></i> Edit Student
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listener to close button using safer approaches
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                });
            }
            
            // Add event listeners to buttons using safer approaches
            const closeModalBtn = modal.querySelector('#closeModalBtn');
            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', function() {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                });
            }
            
            const editStudentBtn = modal.querySelector('#editStudentBtn');
            if (editStudentBtn && student && student.registration_number) {
                editStudentBtn.addEventListener('click', function() {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                    editStudent(student.registration_number);
                });
            }
            
            // Close modal if clicked outside content
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }
            });
        }
          // Edit student function
        function editStudent(regNumber) {
            // Find the student in the data
            const student = studentsData.find(s => s.registration_number === regNumber);
            
            if (!student) {
                showToast(`Student with registration number ${regNumber} not found.`, 'error');
                return;
            }
            
            // Format the date for input field (YYYY-MM-DD)
            let formattedInputDate = '';
            if (student.date_of_birth) {
                try {
                    const dob = new Date(student.date_of_birth);
                    if (!isNaN(dob.getTime())) { // Check if date is valid
                        formattedInputDate = dob.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.warn('Invalid date format for edit:', student.date_of_birth);
                }
            }
            
            // Safely escape values for HTML
            const safeEscape = (value) => {
                if (value === null || value === undefined) return '';
                return String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content edit-student-modal">
                    <div class="modal-header">
                        <h2>Edit Student</h2>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="editStudentForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="editStudentName"><i class="fas fa-user"></i> Full Name</label>
                                    <input type="text" id="editStudentName" class="input-field" value="${safeEscape(student.name)}" required>
                                </div>
                                <div class="form-group">
                                    <label for="editStudentReg"><i class="fas fa-id-card"></i> Registration Number</label>
                                    <input type="text" id="editStudentReg" class="input-field" value="${safeEscape(student.registration_number)}" readonly>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="editStudentCourse"><i class="fas fa-book"></i> Course</label>
                                    <input type="text" id="editStudentCourse" class="input-field" value="${safeEscape(student.course)}" required>
                                </div>
                                <div class="form-group">
                                    <label for="editStudentLevel"><i class="fas fa-calendar-alt"></i> Level of Study</label>
                                    <input type="text" id="editStudentLevel" class="input-field" value="${safeEscape(student.level_of_study)}" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="editStudentNationalId"><i class="fas fa-id-card"></i> National ID</label>
                                    <input type="text" id="editStudentNationalId" class="input-field" value="${safeEscape(student.national_id)}">
                                </div>
                                <div class="form-group">
                                    <label for="editStudentBirthCert"><i class="fas fa-certificate"></i> Birth Certificate</label>
                                    <input type="text" id="editStudentBirthCert" class="input-field" value="${safeEscape(student.birth_certificate)}">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="editStudentDob"><i class="fas fa-birthday-cake"></i> Date of Birth</label>
                                    <input type="date" id="editStudentDob" class="input-field" value="${formattedInputDate}">
                                </div>
                                <div class="form-group">
                                    <label for="editStudentStatus"><i class="fas fa-user-check"></i> Status</label>
                                    <select id="editStudentStatus" class="input-field">
                                        <option value="active" ${(student.status === 'active' || !student.status) ? 'selected' : ''}>Active</option>
                                        <option value="on-leave" ${student.status === 'on-leave' ? 'selected' : ''}>On Leave</option>
                                        <option value="inactive" ${student.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="editStudentPhoto"><i class="fas fa-camera"></i> Student Photo (Optional)</label>
                                <input type="file" id="editStudentPhoto" class="input-field" accept="image/*">
                                <p class="form-help-text">Leave empty to keep current photo</p>
                                ${student.photo_url ? 
                                    `<div class="current-photo">
                                        <p>Current Photo:</p>
                                        <img src="${safeEscape(student.photo_url)}" alt="Current photo" style="max-width: 100px; margin-top: 8px;">
                                    </div>` : 
                                    '<p class="photo-note">No current photo on file</p>'
                                }
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <div class="status-message" id="editStudentStatus" style="display: none;"></div>
                        <button class="btn btn-outline" id="cancelEditBtn">Cancel</button>
                        <button class="btn btn-primary" id="saveStudentBtn">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners using safer approaches
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                });
            }
            
            const cancelBtn = modal.querySelector('#cancelEditBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                });
            }
            
            const saveBtn = modal.querySelector('#saveStudentBtn');
            if (saveBtn && student && student.id) {
                saveBtn.addEventListener('click', function() {
                    saveStudentChanges(student.id);
                });
            }
            
            // Close modal if clicked outside content
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }
            });
        }
          // Function to save student changes
        async function saveStudentChanges(studentId) {
            try {
                // Safe getElementById with error handling
                const safeGetElementValue = (id) => {
                    const element = document.getElementById(id);
                    return element ? element.value.trim() : '';
                };
                
                const name = safeGetElementValue('editStudentName');
                const regNumber = safeGetElementValue('editStudentReg');
                const course = safeGetElementValue('editStudentCourse');
                const level = safeGetElementValue('editStudentLevel');
                const nationalId = safeGetElementValue('editStudentNationalId');
                const birthCert = safeGetElementValue('editStudentBirthCert');
                const dob = safeGetElementValue('editStudentDob');
                
                // Get status from select element
                let status = 'active';
                const statusElement = document.getElementById('editStudentStatus');
                if (statusElement) {
                    status = statusElement.value;
                }
                
                // Validate required fields
                if (!name || !regNumber || !course || !level) {
                    const statusElement = document.getElementById('editStudentStatus');
                    if (statusElement) {
                        statusElement.textContent = 'Please fill out all required fields';
                        statusElement.className = 'status-message error';
                        statusElement.style.display = 'block';
                    } else {
                        showToast('Please fill out all required fields', 'error');
                    }
                    return;
                }
                
                // Find and update save button state
                const saveBtn = document.getElementById('saveStudentBtn');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    const originalContent = saveBtn.innerHTML;
                    saveBtn.innerHTML = '<div class="spinner"></div> Saving...';
                    
                    try {
                        // Check if there is a photo to upload (optional)
                        const photoInput = document.getElementById('editStudentPhoto');
                        const hasPhoto = photoInput && photoInput.files && photoInput.files.length > 0;
                        
                        let result;
                        
                        if (hasPhoto) {
                            // If there's a photo, use FormData to handle the multipart upload
                            const formData = new FormData();
                            formData.append('name', name);
                            formData.append('registration_number', regNumber);
                            formData.append('course', course);
                            formData.append('level_of_study', level);
                            if (nationalId) formData.append('national_id', nationalId);
                            if (birthCert) formData.append('birth_certificate', birthCert);
                            if (dob) formData.append('date_of_birth', dob);
                            formData.append('status', status);
                            formData.append('photo', photoInput.files[0]);
                            
                            debugLog('Sending update for student with photo:', formData);
                            
                            result = await apiRequest(`/students/${studentId}`, {
                                method: 'PUT',
                                body: formData,
                                // Don't set Content-Type header, browser will set it with boundary for FormData
                            });
                        } else {
                            // If no photo, just send JSON data
                            const payload = {
                                name,
                                registration_number: regNumber,
                                course,
                                level_of_study: level,
                                national_id: nationalId || null,
                                birth_certificate: birthCert || null,
                                date_of_birth: dob || null,
                                status
                            };
                            
                            debugLog('Sending update for student:', payload);
                            
                            result = await apiRequest(`/students/${studentId}`, {
                                method: 'PUT',
                                body: JSON.stringify(payload)
                            });
                        }
                        
                        if (result.success) {
                            // Update student in the local data
                            const index = studentsData.findIndex(s => s.id === studentId);
                            if (index !== -1) {
                                // Create updated student data with possible photo URL from response
                                const updatedStudent = { 
                                    ...studentsData[index],
                                    name,
                                    registration_number: regNumber,
                                    course,
                                    level_of_study: level,
                                    national_id: nationalId || null,
                                    birth_certificate: birthCert || null,
                                    date_of_birth: dob || null,
                                    status
                                };
                                
                                // If response includes photo_url, update it
                                if (result.data && result.data.photo_url) {
                                    updatedStudent.photo_url = result.data.photo_url;
                                }
                                
                                studentsData[index] = updatedStudent;
                            }
                            
                            showToast('Student information updated successfully', 'success');
                            renderStudentsTable();
                            
                            // Find and close the modal safely
                            const modal = document.querySelector('.modal');
                            if (modal && modal.parentNode) {
                                modal.parentNode.removeChild(modal);
                            }
                        } else {
                            const statusElement = document.getElementById('editStudentStatus');
                            if (statusElement) {
                                statusElement.textContent = result.error || 'Failed to update student information';
                                statusElement.className = 'status-message error';
                                statusElement.style.display = 'block';
                            } else {
                                showToast(result.error || 'Failed to update student information', 'error');
                            }
                        }
                    } finally {
                        // Restore button state
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = originalContent || '<i class="fas fa-save"></i> Save Changes';
                        }
                    }
                } else {
                    showToast('Cannot find save button element', 'error');
                }
            } catch (error) {
                console.error('Error in saveStudentChanges:', error);
                showToast('An unexpected error occurred. Please try again.', 'error');
            }
        }

        // Authentication functions
        async function adminLogin(event) {
            event.preventDefault();
            
            const username = $('adminUsername').value.trim();
            const password = $('adminPassword').value;
            
            if (!username || !password) {
                showStatus('loginStatus', 'Please enter both username and password', 'error');
                return;
            }            setLoadingState('loginBtn', true);
            
            const result = await apiRequest('/auth/admin-login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            setLoadingState('loginBtn', false, 'Sign In');

            if (result.success && result.data.token) {
                localStorage.setItem(ADMIN_TOKEN_KEY, result.data.token);
                localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify({
                    username: username,
                    id: result.data.adminId || 'unknown'
                }));
                showDashboard();
                showToast('Login successful! Welcome back.');
            } else {
                showStatus('loginStatus', result.error || 'Login failed. Please check your credentials.', 'error');
            }
        }

        function logout() {
            localStorage.removeItem(ADMIN_TOKEN_KEY);
            localStorage.removeItem(ADMIN_DATA_KEY);
            showLogin();
            showToast('Logged out successfully', 'success');
        }

        // View management
        function showDashboard() {
            hideElement($('loginSection'));
            showElement($('dashboardSection'));
            
            // Load admin data if available
            const adminData = JSON.parse(localStorage.getItem(ADMIN_DATA_KEY) || '{}');
            if (adminData.username) {
                $('adminName').textContent = adminData.username;
            }
            
            // Fetch students data when dashboard is shown
            fetchStudents();
        }

        function showLogin() {
            showElement($('loginSection'));
            hideElement($('dashboardSection'));
            // Clear form
            $('loginForm').reset();
        }

        // Student data functions
        async function loadStudentsData(page = 1, size = pageSize, sort = sortField, direction = sortDirection) {
            const result = await apiRequest(`/students?page=${page}&size=${size}&sort=${sort},${direction}`);
            
            if (result.success) {
                studentsData = result.data.items;
                currentPage = result.data.currentPage;
                renderStudentsTable();
            } else {
                showToast(result.error, 'error');
            }
        }

        // Form submission handlers
        async function handleFormSubmission(formId, url, method = 'POST', successMessage = 'Operation completed successfully') {
            const form = $(formId);
            const formData = {};
            
            // Get form data
            const inputs = form.querySelectorAll('input');
            inputs.forEach(input => {
                formData[input.id] = input.value.trim();
            });
            
            // Transform data based on form type
            let payload = {};
            let isFileUpload = false;
            
            switch(formId) {
                case 'registerStudentForm':
                    isFileUpload = $('studentPhoto').files.length > 0;
                    
                    if (isFileUpload) {
                        const studentFormData = new FormData();
                        studentFormData.append('name', formData.studentName);
                        studentFormData.append('registration_number', formData.studentReg);
                        studentFormData.append('course', formData.studentCourse);
                        studentFormData.append('level_of_study', formData.studentYearSemester);
                        studentFormData.append('national_id', formData.studentNationalId || '');
                        studentFormData.append('birth_certificate', formData.studentBirthCert || '');
                        studentFormData.append('date_of_birth', formData.studentDob || '');
                        studentFormData.append('password', formData.studentPassword || '');
                        studentFormData.append('photo', $('studentPhoto').files[0]);
                        payload = studentFormData;
                    } else {
                        payload = {
                            name: formData.studentName,
                            registration_number: formData.studentReg,
                            course: formData.studentCourse,
                            level_of_study: formData.studentYearSemester,
                            national_id: formData.studentNationalId || null,
                            birth_certificate: formData.studentBirthCert || null,
                            date_of_birth: formData.studentDob || null,
                            password: formData.studentPassword || null
                        };
                    }
                    break;
                case 'deregisterStudentForm':
                    payload = {};
                    url = `/students/registration/${formData.deregStudentReg}/deregister`;
                    break;
                case 'registerUnitsForm':
                    payload = {
                        student_reg: formData.unitStudentReg,
                        unit_name: formData.unitName,
                        unit_code: formData.unitCode,
                        status: 'active'
                    };
                    break;
                case 'promoteStudentForm':
                    payload = {
                        registration_number: formData.promoteStudentReg,  // Updated to match API expectations
                        new_level: formData.newYearSemester
                    };
                    console.log('Student promotion payload:', payload);
                    break;
                case 'grantLeaveForm':
                    payload = {
                        registration_number: formData.leaveStudentReg,
                        start_date: formData.leaveStartDate,
                        end_date: formData.leaveEndDate,
                        reason: formData.leaveReason
                    };
                    break;

                case 'readmitStudentForm':
                    const student = studentsData.find(s => s.registration_number === formData.readmitStudentReg);
                    if (!student) {
                        showStatus(form.querySelector('.status-message').id, 'Student not found', 'error');
                        return;
                    }
                    payload = {};
                    url = `/students/${student.id}/restore`;
                    break;
                case 'examCardForm':
                    isFileUpload = true;
                    
                    // Validate the file
                    const examCardFile = $('examCardFile');
                    if (!examCardFile || !examCardFile.files || examCardFile.files.length === 0) {
                        showStatus(form.querySelector('.status-message').id, 'Please select a file to upload', 'error');
                        return;
                    }
                    
                    // Validate file type - only PDF allowed
                    const examCardFileType = examCardFile.files[0].type;
                    const allowedTypes = ['application/pdf'];
                    if (!allowedTypes.includes(examCardFileType) && !examCardFile.files[0].name.toLowerCase().endsWith('.pdf')) {
                        showStatus(form.querySelector('.status-message').id, 'Please upload a PDF file only', 'error');
                        return;
                    }
                    
                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (examCardFile.files[0].size > maxSize) {
                        showStatus(form.querySelector('.status-message').id, 'File size should be less than 5MB', 'error');
                        return;
                    }
                    
                    // Ensure properly formatted field names
                    const regNumber = formData.examCardStudentReg.trim();
                    const fileObj = examCardFile.files[0];
                    
                    // Verify we have valid data before proceeding
                    if (!regNumber) {
                        showStatus(form.querySelector('.status-message').id, 'Please enter a valid registration number', 'error');
                        return;
                    }
                    
                    if (!fileObj || fileObj.size === 0) {
                        showStatus(form.querySelector('.status-message').id, 'Please select a valid file', 'error');
                        return;
                    }
                    
                    // Handle as FormData upload to avoid CORS issues with custom headers
                    url = `/exam-cards`;
                    isFileUpload = true;
                    
                    // Create FormData with proper field names
                    const examCardFormData = new FormData();
                    examCardFormData.append('registration_number', regNumber);
                    examCardFormData.append('file', fileObj); // Use 'file' as the field name
                    
                    payload = examCardFormData;
                    
                    // Log what we're sending
                    debugLog('Exam card FormData upload:', {
                        registration_number: regNumber,
                        file_name: fileObj.name,
                        file_type: fileObj.type,
                        file_size: `${(fileObj.size / 1024).toFixed(2)} KB`,
                        upload_method: 'formdata'
                    });
                    break;
                case 'feesForm':
                    // Check if there's an optional fees statement file
                    const feesStatementFile = $('feesStatementFile');
                    
                    if (feesStatementFile && feesStatementFile.files && feesStatementFile.files.length > 0) {
                        // File upload case - validate PDF file
                        isFileUpload = true;
                        
                        // Validate file type - only PDF allowed
                        const feesFileType = feesStatementFile.files[0].type;
                        if (feesFileType !== 'application/pdf' && !feesStatementFile.files[0].name.toLowerCase().endsWith('.pdf')) {
                            showStatus(form.querySelector('.status-message').id, 'Please upload a PDF file only', 'error');
                            return;
                        }
                        
                        // Validate file size (max 5MB)
                        const feesMaxSize = 5 * 1024 * 1024; // 5MB
                        if (feesStatementFile.files[0].size > feesMaxSize) {
                            showStatus(form.querySelector('.status-message').id, 'File size should be less than 5MB', 'error');
                            return;
                        }
                        
                        // Create FormData for file upload
                        const feesFormData = new FormData();
                        feesFormData.append('registration_number', formData.feesStudentReg);
                        feesFormData.append('fee_balance', formData.feeBalance);
                        feesFormData.append('total_paid', formData.totalPaid);
                        feesFormData.append('semester_fee', formData.semesterFee);
                        feesFormData.append('fees_statement', feesStatementFile.files[0]);
                        
                        payload = feesFormData;
                    } else {
                        // No file upload - just JSON data
                        payload = {
                            registration_number: formData.feesStudentReg,
                            fee_balance: parseFloat(formData.feeBalance),
                            total_paid: parseFloat(formData.totalPaid),
                            semester_fee: parseFloat(formData.semesterFee)
                        };
                    }
                    
                    debugLog('Fees update payload:', payload);
                    break;
                case 'financeForm':
                    isFileUpload = true;
                    
                    // Validate the file
                    const financeFile = $('financeFile');
                    if (!financeFile || !financeFile.files || financeFile.files.length === 0) {
                        showStatus(form.querySelector('.status-message').id, 'Please select a file to upload', 'error');
                        return;
                    }
                    
                    // Validate file type - only PDF allowed
                    const financeFileType = financeFile.files[0].type;
                    if (financeFileType !== 'application/pdf' && !financeFile.files[0].name.toLowerCase().endsWith('.pdf')) {
                        showStatus(form.querySelector('.status-message').id, 'Please upload a PDF file only', 'error');
                        return;
                    }
                    
                    // Validate file size (max 5MB)
                    const financeMaxSize = 5 * 1024 * 1024; // 5MB
                    if (financeFile.files[0].size > financeMaxSize) {
                        showStatus(form.querySelector('.status-message').id, 'File size should be less than 5MB', 'error');
                        return;
                    }
                    
                    const financeFileObj = financeFile.files[0];
                    
                    // Handle as FormData upload to avoid CORS issues with custom headers
                    url = `/finance`;
                    
                    // Create FormData with proper field names
                    const financeFormData = new FormData();
                    financeFormData.append('registration_number', formData.financeStudentReg);
                    financeFormData.append('document_type', formData.documentType);
                    financeFormData.append('document', financeFileObj); // Changed 'file' to 'document' to match API expectations
                    
                    payload = financeFormData;
                    
                    debugLog('Finance FormData upload:', {
                        registration_number: formData.financeStudentReg,
                        document_type: formData.documentType,
                        file_name: financeFileObj.name,
                        file_type: financeFileObj.type,
                        file_size: `${(financeFileObj.size / 1024).toFixed(2)} KB`,
                        upload_method: 'formdata'
                    });
                    break;
                case 'resultsForm':
                    isFileUpload = true;
                    
                    // Validate the file
                    const resultsFile = $('resultsFile');
                    if (!resultsFile || !resultsFile.files || resultsFile.files.length === 0) {
                        showStatus(form.querySelector('.status-message').id, 'Please select a file to upload', 'error');
                        return;
                    }
                    
                    // Validate file type - only PDF allowed
                    const resultsFileType = resultsFile.files[0].type;
                    if (resultsFileType !== 'application/pdf' && !resultsFile.files[0].name.toLowerCase().endsWith('.pdf')) {
                        showStatus(form.querySelector('.status-message').id, 'Please upload a PDF file only', 'error');
                        return;
                    }
                    
                    // Validate file size (max 5MB)
                    const resultsMaxSize = 5 * 1024 * 1024; // 5MB
                    if (resultsFile.files[0].size > resultsMaxSize) {
                        showStatus(form.querySelector('.status-message').id, 'File size should be less than 5MB', 'error');
                        return;
                    }
                    
                    const resultsFileObj = resultsFile.files[0];
                    
                    // Handle as FormData upload to avoid CORS issues with custom headers
                    url = `/results`;
                    
                    // Create FormData with proper field names
                    const resultsFormData = new FormData();
                    resultsFormData.append('registration_number', formData.resultsStudentReg);
                    resultsFormData.append('semester', formData.resultsSemester);
                    resultsFormData.append('results_file', resultsFileObj);
                    
                    payload = resultsFormData;
                    
                    debugLog('Results FormData upload:', {
                        registration_number: formData.resultsStudentReg,
                        semester: formData.resultsSemester,
                        file_name: resultsFileObj.name,
                        file_type: resultsFileObj.type,
                        file_size: `${(resultsFileObj.size / 1024).toFixed(2)} KB`,
                        upload_method: 'formdata'
                    });
                    break;
                case 'timetableForm':
                    isFileUpload = true;
                    
                    // Validate the file
                    const timetableFile = $('timetableFile');
                    if (!timetableFile || !timetableFile.files || timetableFile.files.length === 0) {
                        showStatus(form.querySelector('.status-message').id, 'Please select a file to upload', 'error');
                        return;
                    }
                    
                    // Validate file type - only PDF allowed
                    const timetableFileType = timetableFile.files[0].type;
                    if (timetableFileType !== 'application/pdf' && !timetableFile.files[0].name.toLowerCase().endsWith('.pdf')) {
                        showStatus(form.querySelector('.status-message').id, 'Please upload a PDF file only', 'error');
                        return;
                    }
                    
                    // Validate file size (max 5MB)
                    const timetableMaxSize = 5 * 1024 * 1024; // 5MB
                    if (timetableFile.files[0].size > timetableMaxSize) {
                        showStatus(form.querySelector('.status-message').id, 'File size should be less than 5MB', 'error');
                        return;
                    }
                    
                    const timetableFileObj = timetableFile.files[0];
                    
                    // Handle as FormData upload to avoid CORS issues with custom headers
                    url = `/timetables`;
                    
                    // Create FormData with proper field names
                    const timetableFormData = new FormData();
                    timetableFormData.append('registration_number', formData.timetableStudentReg);
                    timetableFormData.append('semester', formData.timetableSemester);
                    timetableFormData.append('timetable_file', timetableFileObj);
                    
                    payload = timetableFormData;
                    
                    debugLog('Timetable FormData upload:', {
                        registration_number: formData.timetableStudentReg,
                        semester: formData.timetableSemester,
                        file_name: timetableFileObj.name,
                        file_type: timetableFileObj.type,
                        file_size: `${(timetableFileObj.size / 1024).toFixed(2)} KB`,
                        upload_method: 'formdata'
                    });
                    break;
                default:
                    payload = formData;
            }
            
            // Add loading state to the form
            form.classList.add('submitting');
            const submitBtn = form.querySelector('button[type="submit"]');
            const submitBtnId = submitBtn.id || 'submitBtn'; 
            setLoadingState(submitBtnId, true);
            
            let requestOptions = {
                method
            };
            
            if (isFileUpload) {
                // FormData upload - let the browser set the Content-Type with boundary
                requestOptions.body = payload; // FormData object
                
                // Log the FormData field names for debugging
                const formDataFields = [...payload.keys()];
                const hasFiles = [...payload.values()].some(v => v instanceof File);
                
                debugLog('Sending FormData request', {
                    url,
                    method,
                    fields: formDataFields,
                    hasFiles,
                    contentType: 'multipart/form-data (set by browser)'
                });
            } else {
                // For JSON requests
                requestOptions.body = JSON.stringify(payload);
                requestOptions.headers = {
                    'Content-Type': 'application/json'
                };
                
                debugLog('Sending JSON request', {
                    url,
                    method,
                    payload
                });
            }
            
            const result = await apiRequest(url, requestOptions);
            
            // Remove loading state
            form.classList.remove('submitting');
            setLoadingState(submitBtnId, false, submitBtn.textContent.replace('Processing...', '').trim());
            
            const statusElementId = form.querySelector('.status-message').id;
            
            if (result.success) {
                // Update student status based on form type
                if (formId === 'grantLeaveForm' && payload.registration_number) {
                    updateStudentStatus(payload.registration_number, 'on-leave');
                } else if (formId === 'deregisterStudentForm' && formData.deregStudentReg) {
                    updateStudentStatus(formData.deregStudentReg, 'inactive');
                } else if (formId === 'readmitStudentForm' && formData.readmitStudentReg) {
                    updateStudentStatus(formData.readmitStudentReg, 'active');
                }
                showStatus(statusElementId, result.data.message || successMessage, 'success');
                showToast(result.data.message || successMessage);
                form.reset();
            } else {
                showStatus(statusElementId, result.error, 'error');
                showToast(result.error, 'error');
            }
        }

        // Initialize application
        function initializeApp() {
            // Add auto dark mode class to body if user's system prefers dark mode
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('auto-dark-mode');
            }
            
            // Setup file preview for exam card uploads
            setupExamCardFilePreview();
            
            // Setup PDF file preview for all PDF upload forms
            setupPdfFilePreview('financeFile', 'financePreview', 'financeFileInfo');
            setupPdfFilePreview('resultsFile', 'resultsPreview', 'resultsFileInfo');
            setupPdfFilePreview('timetableFile', 'timetablePreview', 'timetableFileInfo');
            setupPdfFilePreview('feesStatementFile', 'feesStatementPreview', 'feesStatementFileInfo');
            
            // Check login status
            const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
            if (adminToken) {
                // Verify token validity
                apiRequest('/admin/verify-token')
                    .then(result => {
                        if (result.success) {
                            showDashboard();
                        } else {
                            localStorage.removeItem(ADMIN_TOKEN_KEY);
                            showLogin();
                        }
                    })
                    .catch(() => {
                        localStorage.removeItem(ADMIN_TOKEN_KEY);
                        showLogin();
                    });
            } else {
                showLogin();
            }

            // Bind login form
            $('loginForm').addEventListener('submit', adminLogin);

            // Bind dashboard forms
            const forms = [
                { id: 'registerStudentForm', url: '/students', message: 'Student registered successfully!' },
                { id: 'deregisterStudentForm', url: '', method: 'POST', message: 'Student deregistered successfully!' },
                { id: 'grantLeaveForm', url: '/students/academic-leave', message: 'Academic leave granted successfully!' },
                { id: 'registerUnitsForm', url: '/units/register', message: 'Unit registered successfully!' },
                { id: 'promoteStudentForm', url: '/students/promote', message: 'Student promoted successfully!' },
                { id: 'readmitStudentForm', url: '', method: 'POST', message: 'Student re-admitted successfully!' },
                { id: 'examCardForm', url: '/exam-cards', message: 'Exam card uploaded successfully!' },
                { id: 'feesForm', url: '/fees', message: 'Fees updated successfully!' },
                { id: 'financeForm', url: '/finance', message: 'Finance document uploaded successfully!' },
                { id: 'resultsForm', url: '/results', message: 'Results uploaded successfully!' },
                { id: 'timetableForm', url: '/timetables', message: 'Timetable uploaded successfully!' }
            ];

            forms.forEach(({ id, url, method = 'POST', message }) => {
                const form = $(id);
                if (form) {
                    form.addEventListener('submit', (event) => {
                        event.preventDefault();
                        handleFormSubmission(id, url, method, message);
                    });
                }
            });

            // Add keyboard shortcuts
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey && event.key === 'l') {
                    event.preventDefault();
                    logout();
                }
            });
        }

        // Start the application
        document.addEventListener('DOMContentLoaded', initializeApp);

        // Handle page visibility change to check token validity
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                const token = localStorage.getItem(ADMIN_TOKEN_KEY);
                if (!token && $('dashboardSection').style.display !== 'none') {
                    showLogin();
                }
            }
        });
          // Update student status function
        function updateStudentStatus(registrationNumber, newStatus) {
            const student = studentsData.find(s => s.registration_number === registrationNumber);
            if (student) {
                student.status = newStatus;
                renderStudentsTable();
            }
        }

        // Expose functions to global scope for HTML event handlers
        window.sortStudents = sortStudents;
        window.handlePagination = handlePagination;
        window.viewStudentDetails = viewStudentDetails;
        window.editStudent = editStudent;
        window.searchStudents = searchStudents;
        window.filterStudents = filterStudents;
        window.fetchStudents = fetchStudents;
        window.saveStudentChanges = saveStudentChanges;
        window.updateStudentStatus = updateStudentStatus;
        window.setupExamCardFilePreview = setupExamCardFilePreview;
        window.debugLog = debugLog;

        // Setup file preview functionality for exam card upload
        function setupExamCardFilePreview() {
            const examCardFileInput = $('examCardFile');
            const examCardPreview = $('examCardPreview');
            const examCardFileInfo = $('examCardFileInfo');
            
            if (!examCardFileInput || !examCardPreview || !examCardFileInfo) return;
            
            examCardFileInput.addEventListener('change', function() {
                // Clear previous preview
                examCardPreview.innerHTML = '';
                examCardFileInfo.innerHTML = '';
                
                // Clear any custom validity
                this.setCustomValidity('');
                
                if (this.files && this.files.length > 0) {
                    const file = this.files[0];
                    let hasErrors = false;
                    
                    // Display file info
                    const fileSize = (file.size / 1024).toFixed(2) + ' KB';
                    examCardFileInfo.innerHTML = `
                        <div class="file-details">
                            <strong>File:</strong> ${file.name}<br>
                            <strong>Type:</strong> ${file.type}<br>
                            <strong>Size:</strong> ${fileSize}
                        </div>
                    `;
                    
                    // Validate file type - only PDF allowed
                    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                    
                    if (isPdf) {
                        examCardPreview.innerHTML = `
                            <div class="pdf-preview">
                                <i class="fas fa-file-pdf pdf-icon"></i>
                                <span>PDF Document</span>
                            </div>
                        `;
                    } else {
                        hasErrors = true;
                        examCardPreview.innerHTML = `
                            <div class="invalid-file-preview">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>Invalid file type (PDF required)</span>
                            </div>
                        `;
                        
                        examCardFileInfo.innerHTML += `
                            <div class="validation-error">
                                Error: Only PDF files are allowed.
                            </div>
                        `;
                        
                        // Set custom validity to prevent form submission
                        this.setCustomValidity('Only PDF files are allowed.');
                    }
                    
                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (file.size > maxSize) {
                        hasErrors = true;
                        examCardFileInfo.innerHTML += `
                            <div class="validation-error">
                                Error: File size must be less than 5MB.
                            </div>
                        `;
                        
                        // Set custom validity to prevent form submission
                        this.setCustomValidity('File size must be less than 5MB.');
                    }
                    
                    // If no errors, clear custom validity
                    if (!hasErrors) {
                        this.setCustomValidity('');
                    }
                } else {
                    // No file selected, clear validity
                    this.setCustomValidity('');
                }
            });
        }

        // Initialize file preview setup
        document.addEventListener('DOMContentLoaded', setupExamCardFilePreview);
        
        // Setup PDF file preview functionality (reusable for all PDF forms)
        function setupPdfFilePreview(fileInputId, previewId, infoId) {
            const fileInput = $(fileInputId);
            const previewDiv = $(previewId);
            const fileInfoDiv = $(infoId);
            
            if (!fileInput || !previewDiv || !fileInfoDiv) return;
            
            fileInput.addEventListener('change', function() {
                // Clear previous preview
                previewDiv.innerHTML = '';
                fileInfoDiv.innerHTML = '';
                
                // Clear any custom validity
                this.setCustomValidity('');
                
                if (this.files && this.files.length > 0) {
                    const file = this.files[0];
                    let hasErrors = false;
                    
                    // Display file info
                    const fileSize = (file.size / 1024).toFixed(2) + ' KB';
                    fileInfoDiv.innerHTML = `
                        <div class="file-details">
                            <strong>File:</strong> ${file.name}<br>
                            <strong>Type:</strong> ${file.type}<br>
                            <strong>Size:</strong> ${fileSize}
                        </div>
                    `;
                    
                    // Validate file type - only PDF allowed
                    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                    
                    if (isPdf) {
                        previewDiv.innerHTML = `
                            <div class="pdf-preview">
                                <i class="fas fa-file-pdf pdf-icon"></i>
                                <span>PDF Document</span>
                            </div>
                        `;
                    } else {
                        hasErrors = true;
                        previewDiv.innerHTML = `
                            <div class="invalid-file-preview">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>Invalid file type (PDF required)</span>
                            </div>
                        `;
                        
                        fileInfoDiv.innerHTML += `
                            <div class="validation-error">
                                Error: Only PDF files are allowed.
                            </div>
                        `;
                        
                        // Set custom validity to prevent form submission
                        this.setCustomValidity('Only PDF files are allowed.');
                    }
                    
                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (file.size > maxSize) {
                        hasErrors = true;
                        fileInfoDiv.innerHTML += `
                            <div class="validation-error">
                                Error: File size must be less than 5MB.
                            </div>
                        `;
                        
                        // Set custom validity to prevent form submission
                        this.setCustomValidity('File size must be less than 5MB.');
                    }
                    
                    // If no errors, clear custom validity
                    if (!hasErrors) {
                        this.setCustomValidity('');
                    }
                } else {
                    // No file selected, clear validity
                    this.setCustomValidity('');
                }
            });
        }