/**
 * store.js - Production-grade Supabase State Management Layer
 * Handles async database sync, real-time broadcasts, role enforcements, and local memory caching.
 */

class AppStore {
    constructor() {
        this.user = null;
        this.profile = null;
        this.shop = null;

        // In-memory cache structures matching local interfaces
        this.inventory = [];
        this.purchases = [];
        this.sales = [];
        this.expenses = [];
        this.salesReturns = [];
        this.purchaseReturns = [];
        this.suppliers = [];
        this.customers = [];
        this.payments = [];
        this.staffList = [];
        this.listeners = [];
        this.realtimeChannels = [];
        this.isLoading = false;

        this.init();
    }

    subscribe(cb) {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter(c => c !== cb); };
    }

    notify() {
        this.listeners.forEach(cb => cb());
    }

    async getLocalItem(key, defaultValue = '[]') {
        if (window.dbClient) {
            try {
                const val = await window.dbClient.get(key);
                if (val !== null) return val;
            } catch (e) {
                console.error("IndexedDB read error, falling back:", e);
            }
        }
        try {
            return JSON.parse(localStorage.getItem(key) || defaultValue);
        } catch (e) {
            return localStorage.getItem(key) || defaultValue;
        }
    }

    async setLocalItem(key, value) {
        if (window.dbClient) {
            try {
                await window.dbClient.set(key, value);
            } catch (e) {
                console.error("IndexedDB write error:", e);
            }
        }
        try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (e) {}
    }

    setupMockClient() {
        window.supabaseClient = {
            auth: {
                signInWithPassword: async ({ email, password }) => {
                    const users = await this.getLocalItem('rf_mock_users', '[]');
                    const user = users.find(u => u.email === email && u.password === password);
                    if (!user) throw new Error("Invalid local login credentials.");
                    
                    await this.setLocalItem('rf_mock_current_user', user);
                    return { data: { user, session: { user } }, error: null };
                },
                signUp: async ({ email, password }) => {
                    const users = await this.getLocalItem('rf_mock_users', '[]');
                    if (users.some(u => u.email === email)) throw new Error("Email already registered locally.");
                    
                    const newUser = { id: 'mock-user-' + Math.random().toString(36).substr(2, 9), email, password };
                    users.push(newUser);
                    await this.setLocalItem('rf_mock_users', users);
                    await this.setLocalItem('rf_mock_current_user', newUser);
                    
                    return { data: { user: newUser, session: { user: newUser } }, error: null };
                },
                signOut: async () => {
                    if (window.dbClient) {
                        try {
                            const transaction = window.dbClient.db.transaction([window.dbClient.storeName], "readwrite");
                            transaction.objectStore(window.dbClient.storeName).delete('rf_mock_current_user');
                        } catch (e) {}
                    }
                    localStorage.removeItem('rf_mock_current_user');
                    return { error: null };
                },
                getSession: async () => {
                    const user = await this.getLocalItem('rf_mock_current_user', 'null');
                    return { data: { session: user ? { user } : null }, error: null };
                },
                onAuthStateChange: (callback) => {
                    return { data: { subscription: { unsubscribe: () => {} } } };
                }
            }
        };
    }

    async init() {
        if (window.dbClient) {
            try {
                await window.dbClient.init();
            } catch (err) {
                console.error("IndexedDB init failure:", err);
            }
        }

        const storedUrl = localStorage.getItem('rf_supabase_url');
        if (storedUrl === 'local_mock') {
            this.isMock = true;
            this.setupMockClient();
        }

        if (!window.supabaseClient) {
            console.warn("Supabase not configured yet. Awaiting setup.");
            return;
        }

        this.isLoading = true;
        this.notify();

        try {
            // Check active session
            const { data: { session }, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;

            if (session) {
                this.user = session.user;
                this.isGuest = false;
                await this.loadUserProfileAndBootstrap();
            } else {
                // Not logged in -> Boot in Guest Mode using beautiful offline mock data!
                console.log("No active remote session. Booting in Guest Mode.");
                this.isGuest = true;
                this.isMock = true;
                this.setupMockClient();
                await this.loadAllData();
                this.showGuestView();
            }

            // Register global auth state change listener
            window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (session) {
                    this.user = session.user;
                    this.isGuest = false;
                    if (!this.profile) {
                        await this.loadUserProfileAndBootstrap();
                    }
                } else {
                    console.log("Session lost. Booting in Guest Mode.");
                    this.isGuest = true;
                    this.isMock = true;
                    this.setupMockClient();
                    await this.loadAllData();
                    this.showGuestView();
                }
            });

        } catch (err) {
            console.error("Initialization error:", err);
            console.log("Error loading remote session. Booting in Guest Mode.");
            this.isGuest = true;
            this.isMock = true;
            this.setupMockClient();
            await this.loadAllData();
            this.showGuestView();
        } finally {
            this.isLoading = false;
            this.notify();
        }
    }

    showLoginView() {
        this.showLoginModal();
    }

    showLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) modal.style.display = 'flex';
    }

    hideLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) modal.style.display = 'none';
    }

    showGuestView() {
        this.isGuest = true;
        this.isMock = true;

        const sidebar = document.querySelector('.sidebar');
        const topBar = document.querySelector('.top-bar');
        const userWidget = document.getElementById('user-profile-widget');
        const guestWidget = document.getElementById('guest-login-widget');

        if (sidebar) sidebar.style.display = 'flex';
        if (topBar) topBar.style.display = 'flex';
        if (userWidget) userWidget.style.display = 'none';
        if (guestWidget) guestWidget.style.display = 'flex';

        // Set default page to dashboard
        const pages = document.querySelectorAll('.page');
        pages.forEach(p => p.classList.toggle('active', p.id === 'dashboard'));

        const topBarTitle = document.getElementById('topbar-title');
        if (topBarTitle) {
            const activeNode = document.querySelector(`.nav-links li[data-tab="dashboard"]`);
            if (activeNode) {
                topBarTitle.innerText = activeNode.querySelector('span').innerText;
                const navs = document.querySelectorAll('.nav-links li');
                navs.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === 'dashboard'));
            }
        }
    }

    showAppView() {
        if (this.profile && this.profile.role === 'cashier') {
            document.documentElement.classList.add('role-cashier');
        } else {
            document.documentElement.classList.remove('role-cashier');
        }

        const sidebar = document.querySelector('.sidebar');
        const topBar = document.querySelector('.top-bar');
        const userWidget = document.getElementById('user-profile-widget');
        const guestWidget = document.getElementById('guest-login-widget');
        const nameLabel = document.getElementById('nav-user-name');
        const roleLabel = document.getElementById('nav-user-role');

        if (sidebar) sidebar.style.display = 'flex';
        if (topBar) topBar.style.display = 'flex';
        if (guestWidget) guestWidget.style.display = 'none';
        this.isGuest = false;
        
        if (userWidget && this.profile) {
            userWidget.style.display = 'flex';
            if (nameLabel) nameLabel.innerText = this.profile.full_name;
            if (roleLabel) {
                roleLabel.innerText = this.profile.role;
                roleLabel.className = 'badge ' + 
                    (this.profile.role === 'owner' ? 'badge-success' : 
                     this.profile.role === 'cashier' ? 'badge-warning' : 'badge-success');
            }
        }

        // Apply Tab Level access controls
        this.enforceRoleNavigation();

        // Load Default Tab
        const activeTabEl = document.querySelector('.nav-links li.active');
        let defaultTab = activeTabEl ? activeTabEl.getAttribute('data-tab') : 'dashboard';

        if (this.profile && this.profile.role === 'cashier' && defaultTab === 'dashboard') {
            defaultTab = 'sales';
            const navs = document.querySelectorAll('.nav-links li');
            navs.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === 'sales'));
        }

        const pages = document.querySelectorAll('.page');
        pages.forEach(p => p.classList.toggle('active', p.id === defaultTab));
        
        const topBarTitle = document.getElementById('topbar-title');
        if (topBarTitle) {
            const activeNode = document.querySelector(`.nav-links li[data-tab="${defaultTab}"]`);
            if (activeNode) topBarTitle.innerText = activeNode.querySelector('span').innerText;
        }
    }

    enforceRoleNavigation() {
        if (!this.profile) return;
        const role = this.profile.role;
        const navs = document.querySelectorAll('.nav-links li[data-tab]');
        
        navs.forEach(nav => {
            const tab = nav.getAttribute('data-tab');
            if (role === 'cashier') {
                // Cashier can only see: sales, inventory, purchases, customers
                const allowed = ['sales', 'inventory', 'purchases', 'customers'];
                nav.style.display = allowed.includes(tab) ? 'flex' : 'none';
            } else if (role === 'viewer') {
                // Viewer can only see: dashboard, reports
                const allowed = ['dashboard', 'reports'];
                nav.style.display = allowed.includes(tab) ? 'flex' : 'none';
            } else {
                // Owner can see everything
                nav.style.display = 'flex';
            }
        });

        // Hide Edit/Delete buttons dynamically if cashier or viewer
        const addForms = document.querySelectorAll('.form-container, .return-form-container');
        addForms.forEach(f => {
            if (role === 'viewer') {
                f.style.display = 'none';
            } else if (role === 'cashier') {
                // Cashier cannot log expenses or returns
                const parentPage = f.closest('.page')?.id;
                if (parentPage === 'expenses' || parentPage === 'returns' || parentPage === 'inventory') {
                    f.style.display = 'none';
                } else {
                    f.style.display = 'flex';
                }
            } else {
                f.style.display = 'flex';
            }
        });
    }

    async loadUserProfileAndBootstrap() {
        if (this.isMock) {
            const profiles = await this.getLocalItem('rf_mock_profiles', '[]');
            const profile = profiles.find(p => p.id === this.user.id);
            if (!profile) {
                this.renderOnboardingWizard();
            } else {
                this.profile = profile;
                const shops = await this.getLocalItem('rf_mock_shops', '[]');
                this.shop = shops.find(s => s.id === this.profile.shop_id) || { name: 'Local Store' };
                this.showAppView();
                await this.loadAllData();
                this.checkBackupReminder();
            }
            return;
        }

        try {
            const { data: profile, error } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .maybeSingle();

            if (error) throw error;

            if (!profile) {
                // Prompt User Onboarding
                this.renderOnboardingWizard();
            } else {
                this.profile = profile;
                
                // Load shop metadata
                const { data: shop, error: shopErr } = await window.supabaseClient
                    .from('shops')
                    .select('*')
                    .eq('id', this.profile.shop_id)
                    .single();

                if (shopErr) throw shopErr;
                this.shop = shop;

                this.showAppView();
                await this.loadAllData();
                this.subscribeRealtime();
                this.checkBackupReminder();
            }
        } catch (err) {
            console.error("Profile bootstrapping error:", err);
            window.showToast("Bootstrap failed: " + err.message, "error");
            
            const diagPanel = document.getElementById('diagnostics-panel');
            const diagError = document.getElementById('diagnostics-error');
            if (diagPanel && diagError) {
                diagPanel.style.display = 'block';
                diagError.innerText = "Bootstrap Error: " + err.message + 
                    "\n\nThis usually means you have not initialized your Supabase database schema, or the RLS policies are blocking the read. " +
                    "Please make sure you have executed the full 'schema.sql' file inside your Supabase project's SQL Editor.";
            }
            
            this.showGuestView();
        }
    }

    async checkBackupReminder() {
        try {
            const lastBackup = await this.getLocalItem('rf_last_backup_date', 'null');
            let shouldRemind = false;
            if (!lastBackup || lastBackup === 'null') {
                shouldRemind = true;
            } else {
                const elapsed = Date.now() - new Date(lastBackup).getTime();
                const sevenDays = 7 * 24 * 60 * 60 * 1000;
                if (elapsed > sevenDays) {
                    shouldRemind = true;
                }
            }
            if (shouldRemind && this.profile && this.profile.role === 'owner') {
                setTimeout(() => {
                    window.showToast("⚠️ Security Notice: You haven't backed up your ledger recently. Please export a JSON backup from Settings!", "warning", 8000);
                }, 3000);
            }
        } catch (e) {
            console.error("Backup check error:", e);
        }
    }

    renderOnboardingWizard() {
        // Destroy any existing onboarding
        document.getElementById('rf-onboarding-wizard')?.remove();

        const onboarding = document.createElement('div');
        onboarding.id = 'rf-onboarding-wizard';
        onboarding.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(13, 17, 23, 0.96);
            backdrop-filter: blur(12px);
            display: flex; align-items: center; justify-content: center;
            z-index: 99998;
            color: #f1f5f9;
            font-family: 'Inter', sans-serif;
            overflow-y: auto;
            padding: 20px;
        `;

        onboarding.innerHTML = `
            <div style="
                background: linear-gradient(145deg, #161b22, #0d1117);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 40px;
                max-width: 540px;
                width: 100%;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                animation: fadeUp 0.4s ease-out;
            ">
                <h2 style="font-family: 'Outfit'; font-size: 1.8rem; font-weight: 800; background: linear-gradient(to right, #fff, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align:center; margin-bottom: 20px;">
                    Configure Your Profile
                </h2>
                
                <form id="onboarding-form" style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Your Full Name</label>
                        <input type="text" id="onb-name" required placeholder="John Doe" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:11px; color:#fff; border-radius:8px;">
                    </div>
                    
                    <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:16px; margin-top:4px;">
                        <div style="display:flex; gap:16px; margin-bottom:12px;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-size:0.9rem;">
                                <input type="radio" name="onb-type" value="create" checked style="width:16px; height:16px;"> Create a New Shop
                            </label>
                            <label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-size:0.9rem;">
                                <input type="radio" name="onb-type" value="join" style="width:16px; height:16px;"> Join Invited Shop
                            </label>
                        </div>
                    </div>

                    <div id="onb-create-shop-fields" style="display:flex; flex-direction:column; gap:14px;">
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <label style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Shop Name</label>
                            <input type="text" id="onb-shop-name" placeholder="RetailFlow Karwan Bazar" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:11px; color:#fff; border-radius:8px;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <label style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Address</label>
                            <input type="text" id="onb-shop-address" placeholder="Karwan Bazar, Dhaka" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:11px; color:#fff; border-radius:8px;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <label style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Phone Number</label>
                            <input type="text" id="onb-shop-phone" placeholder="01700000000" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding:11px; color:#fff; border-radius:8px;">
                        </div>
                    </div>

                    <div id="onb-join-shop-fields" style="display:none; flex-direction:column; gap:14px;">
                        <div style="background: rgba(124,58,237,0.06); border:1px solid rgba(124,58,237,0.15); padding:12px; border-radius:8px; font-size:0.82rem; color:#a78bfa; line-height:1.4;">
                            ℹ️ If the owner of a retail shop invited your email (<strong>${this.user.email}</strong>), your profile will automatically sync and assign to their shop with the invited cashier/viewer role!
                        </div>
                    </div>

                    <button type="submit" class="btn-add" style="padding:14px; font-weight:700; margin-top:8px;">Complete Setup ✨</button>
                </form>
            </div>
        `;

        document.body.appendChild(onboarding);

        const types = onboarding.querySelectorAll('input[name="onb-type"]');
        const createFields = onboarding.querySelector('#onb-create-shop-fields');
        const joinFields = onboarding.querySelector('#onb-join-shop-fields');

        types.forEach(t => t.addEventListener('change', (e) => {
            const isJoin = e.target.value === 'join';
            createFields.style.display = isJoin ? 'none' : 'flex';
            joinFields.style.display = isJoin ? 'flex' : 'none';
        }));

        const form = onboarding.querySelector('#onboarding-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (this.isMock) {
                const fullName = onboarding.querySelector('#onb-name').value.trim();
                const type = onboarding.querySelector('input[name="onb-type"]:checked').value;
                if (!fullName) return;
                
                onboarding.querySelector('button[type="submit"]').innerText = "Saving Profile...";
                onboarding.querySelector('button[type="submit"]').disabled = true;

                try {
                    if (type === 'create') {
                        const shopName = onboarding.querySelector('#onb-shop-name').value.trim() || 'My Retail Shop';
                        const shopAddress = onboarding.querySelector('#onb-shop-address').value.trim() || '';
                        const shopPhone = onboarding.querySelector('#onb-shop-phone').value.trim() || '';

                        const mockShop = { id: 'mock-shop-' + Math.random().toString(36).substr(2, 9), name: shopName, owner_name: fullName, address: shopAddress, phone: shopPhone };
                        const shops = await this.getLocalItem('rf_mock_shops', '[]');
                        shops.push(mockShop);
                        await this.setLocalItem('rf_mock_shops', shops);

                        const mockProfile = { id: this.user.id, full_name: fullName, role: 'owner', shop_id: mockShop.id };
                        const profiles = await this.getLocalItem('rf_mock_profiles', '[]');
                        profiles.push(mockProfile);
                        await this.setLocalItem('rf_mock_profiles', profiles);
                    } else {
                        // Check local invitations first
                        const invitations = await this.getLocalItem('rf_mock_invitations', '[]');
                        const invite = invitations.find(inv => inv.email.toLowerCase() === this.user.email.toLowerCase());
                        
                        let shopId = 'mock-invited-shop';
                        let role = 'cashier';
                        
                        if (invite) {
                            shopId = invite.shop_id;
                            role = invite.role;
                            // Clear invite
                            const remaining = invitations.filter(inv => inv.email.toLowerCase() !== this.user.email.toLowerCase());
                            await this.setLocalItem('rf_mock_invitations', remaining);
                        } else {
                            // Fallback if no invite exists, create a default shop link
                            const mockShop = { id: 'mock-invited-shop', name: 'RetailFlow Invited Shop', owner_name: 'Shop Owner' };
                            const shops = await this.getLocalItem('rf_mock_shops', '[]');
                            if (!shops.some(s => s.id === mockShop.id)) {
                                shops.push(mockShop);
                                await this.setLocalItem('rf_mock_shops', shops);
                            }
                        }

                        const mockProfile = { id: this.user.id, full_name: fullName, role: role, shop_id: shopId };
                        const profiles = await this.getLocalItem('rf_mock_profiles', '[]');
                        profiles.push(mockProfile);
                        await this.setLocalItem('rf_mock_profiles', profiles);
                    }

                    onboarding.remove();
                    await this.loadUserProfileAndBootstrap();
                    return;
                } catch (err) {
                    alert("Mock Setup failed: " + err.message);
                    onboarding.querySelector('button[type="submit"]').innerText = "Complete Setup ✨";
                    onboarding.querySelector('button[type="submit"]').disabled = false;
                    return;
                }
            }

            const fullName = onboarding.querySelector('#onb-name').value.trim();
            const type = onboarding.querySelector('input[name="onb-type"]:checked').value;

            if (!fullName) return;

            onboarding.querySelector('button[type="submit"]').innerText = "Saving Profile...";
            onboarding.querySelector('button[type="submit"]').disabled = true;

            try {
                if (type === 'create') {
                    const shopName = onboarding.querySelector('#onb-shop-name').value.trim() || 'My Retail Shop';
                    const shopAddress = onboarding.querySelector('#onb-shop-address').value.trim() || '';
                    const shopPhone = onboarding.querySelector('#onb-shop-phone').value.trim() || '';

                    // 1. Create shop
                    const { data: newShop, error: shopErr } = await window.supabaseClient
                        .from('shops')
                        .insert({ name: shopName, owner_name: fullName, address: shopAddress, phone: shopPhone })
                        .select()
                        .single();

                    if (shopErr) throw shopErr;

                    // 2. Create profile as owner
                    const { error: profErr } = await window.supabaseClient
                        .from('profiles')
                        .insert({ id: this.user.id, full_name: fullName, role: 'owner', shop_id: newShop.id });

                    if (profErr) throw profErr;

                } else {
                    // Check invitations
                    const { data: invite, error: inviteErr } = await window.supabaseClient
                        .from('invitations')
                        .select('*')
                        .eq('email', this.user.email)
                        .maybeSingle();

                    if (inviteErr) throw inviteErr;

                    if (!invite) {
                        alert(`No invitation found for email ${this.user.email}. Create a shop instead!`);
                        onboarding.querySelector('button[type="submit"]').innerText = "Complete Setup ✨";
                        onboarding.querySelector('button[type="submit"]').disabled = false;
                        return;
                    }

                    // Create profile with invited shop/role
                    const { error: profErr } = await window.supabaseClient
                        .from('profiles')
                        .insert({ id: this.user.id, full_name: fullName, role: invite.role, shop_id: invite.shop_id });

                    if (profErr) throw profErr;

                    // Clear invitation
                    await window.supabaseClient.from('invitations').delete().eq('id', invite.id);
                }

                // Complete bootstrap
                onboarding.remove();
                await this.loadUserProfileAndBootstrap();

            } catch (err) {
                console.error("Onboarding failed:", err);
                alert("Setup failed: " + err.message);
                onboarding.querySelector('button[type="submit"]').innerText = "Complete Setup ✨";
                onboarding.querySelector('button[type="submit"]').disabled = false;
            }
        });
    }

    async loadAllData() {
        if (this.isMock) {
            const shopId = this.profile ? this.profile.shop_id : 'guest-shop-id';
            
            // Load Products
            let products = await this.getLocalItem('rf_mock_products', '[]');
            if (products.length === 0) {
                await this.seedMockData(shopId);
                products = await this.getLocalItem('rf_mock_products', '[]');
            }
            this.inventory = products.filter(p => p.shop_id === shopId).map(p => ({
                uuid: p.id,
                id: p.product_code,
                name: p.name,
                category: p.category || 'General',
                cost: Number(p.cost_price),
                sell: Number(p.selling_price),
                stock: Number(p.stock),
                unit: p.unit_type,
                minStock: p.low_stock_threshold
            }));

            // Load Suppliers
            const suppliers = await this.getLocalItem('rf_mock_suppliers', '[]');
            this.suppliers = suppliers.filter(s => s.shop_id === shopId);

            // Load Customers
            const customers = await this.getLocalItem('rf_mock_customers', '[]');
            this.customers = customers.filter(c => c.shop_id === shopId);

            // Load Purchases
            const purchases = await this.getLocalItem('rf_mock_purchases', '[]');
            this.purchases = purchases.filter(p => p.shop_id === shopId).map(p => {
                const prod = products.find(pr => pr.id === p.product_id);
                const sup = suppliers.find(su => su.id === p.supplier_id);
                return {
                    uuid: p.id,
                    date: p.purchase_date,
                    id: prod ? prod.product_code : 'N/A',
                    name: prod ? prod.name : 'N/A',
                    productId: p.product_id,
                    qty: Number(p.quantity),
                    unitCost: Number(p.cost_per_unit),
                    totalCost: Number(p.total_cost),
                    supplierId: p.supplier_id,
                    supplierName: sup ? sup.name : 'N/A'
                };
            });

            // Load Sales
            const sales = await this.getLocalItem('rf_mock_sales', '[]');
            const groupedSalesMap = {};
            sales.filter(s => s.shop_id === shopId).forEach(row => {
                const prod = products.find(pr => pr.id === row.product_id);
                const cust = customers.find(cu => cu.id === row.customer_id);
                if (!groupedSalesMap[row.invoice_no]) {
                    groupedSalesMap[row.invoice_no] = {
                        invoiceNo: row.invoice_no,
                        date: row.sale_date,
                        isCredit: row.is_credit,
                        customerId: row.customer_id,
                        customerName: cust ? cust.name : 'N/A',
                        items: [],
                        totalSales: 0,
                        profit: 0,
                        discountAmount: 0,
                        seasonalOffer: row.seasonal_offer || '',
                        timestamp: new Date(row.created_at || row.sale_date).getTime()
                    };
                }
                const totalItemRev = Number(row.total_revenue);
                const itemProfit = Number(row.estimated_profit);
                const itemDiscount = Number(row.discount_amount || 0);
                groupedSalesMap[row.invoice_no].items.push({
                    uuid: row.id,
                    id: prod ? prod.product_code : 'N/A',
                    productId: row.product_id,
                    name: prod ? prod.name : 'N/A',
                    qty: Number(row.quantity),
                    unitPrice: Number(row.unit_price),
                    discountAmount: itemDiscount,
                    totalSales: totalItemRev,
                    profit: itemProfit
                });
                groupedSalesMap[row.invoice_no].totalSales += totalItemRev;
                groupedSalesMap[row.invoice_no].profit += itemProfit;
                groupedSalesMap[row.invoice_no].discountAmount += itemDiscount;
            });
            this.sales = Object.values(groupedSalesMap).sort((a,b) => b.timestamp - a.timestamp);

            // Load Expenses
            const expenses = await this.getLocalItem('rf_mock_expenses', '[]');
            this.expenses = expenses.filter(e => e.shop_id === shopId).map(e => ({
                uuid: e.id,
                date: e.expense_date,
                category: e.category,
                amount: Number(e.amount),
                note: e.note || ''
            }));

            // Load Payments
            const payments = await this.getLocalItem('rf_mock_payments', '[]');
            this.payments = payments.filter(p => p.shop_id === shopId).map(p => {
                const cust = customers.find(c => c.id === p.customer_id);
                return {
                    uuid: p.id,
                    date: p.payment_date,
                    customerId: p.customer_id,
                    customerName: cust ? cust.name : 'N/A',
                    amount: Number(p.amount),
                    note: p.note || ''
                };
            });

            // Load Returns
            const returns = await this.getLocalItem('rf_mock_returns', '[]');
            this.salesReturns = [];
            this.purchaseReturns = [];
            returns.filter(r => r.shop_id === shopId).forEach(r => {
                const prod = products.find(p => p.id === r.product_id);
                const item = {
                    uuid: r.id,
                    date: r.return_date,
                    id: prod ? prod.product_code : 'N/A',
                    productId: r.product_id,
                    name: prod ? prod.name : 'N/A',
                    qty: Number(r.quantity),
                    amount: Number(r.amount),
                    reason: r.reason || ''
                };
                if (r.type === 'sales_return') {
                    item.totalRefund = Number(r.amount);
                    item.profitLoss = 0;
                    this.salesReturns.push(item);
                } else {
                    item.totalCost = Number(r.amount);
                    this.purchaseReturns.push(item);
                }
            });

            // Load Active Staff
            const profiles = await this.getLocalItem('rf_mock_profiles', '[]');
            this.staffList = profiles.filter(p => p.shop_id === shopId).map(p => ({
                full_name: p.full_name,
                role: p.role
            }));

            this.notify();
            return;
        }

        if (!this.profile) return;
        
        try {
            // Load Products
            const { data: products } = await window.supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            this.inventory = (products || []).map(p => ({
                uuid: p.id,
                id: p.product_code,
                name: p.name,
                category: p.category || 'General',
                cost: Number(p.cost_price),
                sell: Number(p.selling_price),
                stock: Number(p.stock),
                unit: p.unit_type,
                minStock: p.low_stock_threshold
            }));

            // Load Suppliers
            const { data: suppliers } = await window.supabaseClient
                .from('suppliers')
                .select('*')
                .order('created_at', { ascending: false });
            this.suppliers = suppliers || [];

            // Load Customers
            const { data: customers } = await window.supabaseClient
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });
            this.customers = customers || [];

            // Load Purchases
            const { data: purchases } = await window.supabaseClient
                .from('purchases')
                .select('*, products(product_code, name), suppliers(name)')
                .order('purchase_date', { ascending: false });
            this.purchases = (purchases || []).map(p => ({
                uuid: p.id,
                date: p.purchase_date,
                id: p.products ? p.products.product_code : 'N/A',
                name: p.products ? p.products.name : 'N/A',
                productId: p.product_id,
                qty: Number(p.quantity),
                unitCost: Number(p.cost_per_unit),
                totalCost: Number(p.total_cost),
                supplierId: p.supplier_id,
                supplierName: p.suppliers ? p.suppliers.name : 'N/A'
            }));

            // Load Sales
            const { data: sales } = await window.supabaseClient
                .from('sales')
                .select('*, products(product_code, name), customers(name)')
                .order('sale_date', { ascending: false });
            
            // Group flat Sales rows by invoice_no in memory to match checkout carts!
            const groupedSalesMap = {};
            (sales || []).forEach(row => {
                if (!groupedSalesMap[row.invoice_no]) {
                    groupedSalesMap[row.invoice_no] = {
                        invoiceNo: row.invoice_no,
                        date: row.sale_date,
                        isCredit: row.is_credit,
                        customerId: row.customer_id,
                        customerName: row.customers ? row.customers.name : 'N/A',
                        items: [],
                        totalSales: 0,
                        profit: 0,
                        timestamp: new Date(row.created_at).getTime()
                    };
                }
                const totalItemRev = Number(row.total_revenue);
                const itemProfit = Number(row.estimated_profit);
                groupedSalesMap[row.invoice_no].items.push({
                    uuid: row.id,
                    id: row.products ? row.products.product_code : 'N/A',
                    productId: row.product_id,
                    name: row.products ? row.products.name : 'N/A',
                    qty: Number(row.quantity),
                    unitPrice: Number(row.unit_price),
                    totalSales: totalItemRev,
                    profit: itemProfit
                });
                groupedSalesMap[row.invoice_no].totalSales += totalItemRev;
                groupedSalesMap[row.invoice_no].profit += itemProfit;
            });
            this.sales = Object.values(groupedSalesMap).sort((a,b) => b.timestamp - a.timestamp);

            // Load Expenses
            const { data: expenses } = await window.supabaseClient
                .from('expenses')
                .select('*')
                .order('expense_date', { ascending: false });
            this.expenses = (expenses || []).map(e => ({
                uuid: e.id,
                date: e.expense_date,
                category: e.category,
                amount: Number(e.amount),
                note: e.note || ''
            }));

            // Load Payments
            const { data: payments } = await window.supabaseClient
                .from('payments')
                .select('*, customers(name)')
                .order('payment_date', { ascending: false });
            this.payments = (payments || []).map(p => ({
                uuid: p.id,
                date: p.payment_date,
                customerId: p.customer_id,
                customerName: p.customers ? p.customers.name : 'N/A',
                amount: Number(p.amount),
                note: p.note || ''
            }));

            // Load Returns
            const { data: returns } = await window.supabaseClient
                .from('returns')
                .select('*, products(product_code, name)')
                .order('return_date', { ascending: false });
            
            this.salesReturns = [];
            this.purchaseReturns = [];
            (returns || []).forEach(r => {
                const item = {
                    uuid: r.id,
                    date: r.return_date,
                    id: r.products ? r.products.product_code : 'N/A',
                    productId: r.product_id,
                    name: r.products ? r.products.name : 'N/A',
                    qty: Number(r.quantity),
                    amount: Number(r.amount),
                    reason: r.reason || ''
                };
                if (r.type === 'sales_return') {
                    // map layout formats
                    item.totalRefund = Number(r.amount);
                    item.profitLoss = 0; // estimate reduction
                    this.salesReturns.push(item);
                } else {
                    item.totalCost = Number(r.amount);
                    this.purchaseReturns.push(item);
                }
            });

            // Load Active Shop Staff (profiles)
            const { data: staff } = await window.supabaseClient
                .from('profiles')
                .select('full_name, role');
            this.staffList = staff || [];

            this.notify();
        } catch (err) {
            console.error("Data load failed:", err);
        }
    }

    subscribeRealtime() {
        if (!window.supabaseClient) return;

        // Clear existing realtime listeners
        this.realtimeChannels.forEach(c => c.unsubscribe());
        this.realtimeChannels = [];

        const tables = ['products', 'purchases', 'sales', 'expenses', 'suppliers', 'customers', 'returns', 'payments'];
        tables.forEach(t => {
            const channel = window.supabaseClient.channel(`realtime-${t}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
                    this.loadAllData();
                })
                .subscribe();
            this.realtimeChannels.push(channel);
        });
    }

    async logout() {
        if (window.playBeep) window.playBeep('success');
        if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
        }
        localStorage.removeItem('rf_supabase_url');
        localStorage.removeItem('rf_supabase_key');
        localStorage.removeItem('rf_supabase_reset');
        this.user = null;
        this.profile = null;
        this.shop = null;
        this.isGuest = true;
        this.isMock = true;
        window.location.reload();
    }

    async seedMockData(shopId) {
        console.log("Seeding beautiful guest/demo mockup data...");
        const products = [
            { id: 'mock-p1', shop_id: shopId, product_code: 'PROD-101', name: 'Premium Coffee Beans', category: 'Beverages', cost_price: 12.00, selling_price: 19.99, stock: 45.0, unit_type: 'packet', low_stock_threshold: 10 },
            { id: 'mock-p2', shop_id: shopId, product_code: 'PROD-102', name: 'Organic Green Tea', category: 'Beverages', cost_price: 4.50, selling_price: 8.50, stock: 60.0, unit_type: 'box', low_stock_threshold: 10 },
            { id: 'mock-p3', shop_id: shopId, product_code: 'PROD-103', name: 'Chocolate Chip Cookies', category: 'Snacks', cost_price: 2.20, selling_price: 4.99, stock: 8.0, unit_type: 'box', low_stock_threshold: 15 },
            { id: 'mock-p4', shop_id: shopId, product_code: 'PROD-104', name: 'Whole Grain Oats', category: 'Grocery', cost_price: 3.10, selling_price: 5.50, stock: 120.0, unit_type: 'bag', low_stock_threshold: 20 },
            { id: 'mock-p5', shop_id: shopId, product_code: 'PROD-105', name: 'Fresh Almond Milk', category: 'Dairy', cost_price: 1.80, selling_price: 3.49, stock: 25.0, unit_type: 'bottle', low_stock_threshold: 8 },
            { id: 'mock-p6', shop_id: shopId, product_code: 'PROD-106', name: 'Extra Virgin Olive Oil', category: 'Grocery', cost_price: 8.00, selling_price: 14.99, stock: 30.0, unit_type: 'bottle', low_stock_threshold: 5 },
            { id: 'mock-p7', shop_id: shopId, product_code: 'PROD-107', name: 'Natural Honey Jar', category: 'Grocery', cost_price: 6.50, selling_price: 11.99, stock: 18.0, unit_type: 'pcs', low_stock_threshold: 5 },
            { id: 'mock-p8', shop_id: shopId, product_code: 'PROD-108', name: 'Crunchy Peanut Butter', category: 'Snacks', cost_price: 2.80, selling_price: 5.25, stock: 40.0, unit_type: 'pcs', low_stock_threshold: 10 },
            { id: 'mock-p9', shop_id: shopId, product_code: 'PROD-109', name: 'Dark Chocolate Bar', category: 'Snacks', cost_price: 1.50, selling_price: 3.50, stock: 85.0, unit_type: 'pcs', low_stock_threshold: 20 },
            { id: 'mock-p10', shop_id: shopId, product_code: 'PROD-110', name: 'Basmati Rice 5kg', category: 'Grocery', cost_price: 9.00, selling_price: 15.99, stock: 50.0, unit_type: 'bag', low_stock_threshold: 10 }
        ];

        const suppliers = [
            { id: 'mock-s1', shop_id: shopId, name: 'Apex Foods Distributors', phone: '+8801711223344', address: 'Tejgaon, Dhaka', notes: 'Primary supplier for snacks and beverages' },
            { id: 'mock-s2', shop_id: shopId, name: 'Greenfield Organic Farm', phone: '+8801811556677', address: 'Savar, Dhaka', notes: 'Supplier for honey, oats, and organic tea' },
            { id: 'mock-s3', shop_id: shopId, name: 'Euro Imports Ltd', phone: '+8801911889900', address: 'Gulshan, Dhaka', notes: 'Premium olive oil and coffee beans supplier' }
        ];

        const customers = [
            { id: 'mock-c1', shop_id: shopId, name: 'Alice Vance', phone: '01700112233', total_due: 150.00 },
            { id: 'mock-c2', shop_id: shopId, name: 'Bob Johnson', phone: '01800445566', total_due: 0.00 },
            { id: 'mock-c3', shop_id: shopId, name: 'Charlie Miller', phone: '01900778899', total_due: 45.50 },
            { id: 'mock-c4', shop_id: shopId, name: 'Diana Ross', phone: '01500224466', total_due: 0.00 }
        ];

        const expenses = [
            { id: 'mock-e1', shop_id: shopId, category: 'Rent', amount: 500.00, note: 'Monthly store rent for May', expense_date: '2026-05-01' },
            { id: 'mock-e2', shop_id: shopId, category: 'Electricity', amount: 120.00, note: 'Electricity bill for shop', expense_date: '2026-05-15' },
            { id: 'mock-e3', shop_id: shopId, category: 'Salary', amount: 300.00, note: 'Part-time assistant salary', expense_date: '2026-05-28' },
            { id: 'mock-e4', shop_id: shopId, category: 'Transport', amount: 45.00, note: 'Delivery van fuel', expense_date: '2026-05-26' },
            { id: 'mock-e5', shop_id: shopId, category: 'Supplies', amount: 35.00, note: 'Paper bags and POS receipt rolls', expense_date: '2026-05-25' }
        ];

        const purchases = [
            { id: 'mock-pu1', shop_id: shopId, product_id: 'mock-p1', supplier_id: 'mock-s3', quantity: 50, cost_per_unit: 12.00, total_cost: 600.00, purchase_date: '2026-05-20', notes: 'Initial premium stock import' },
            { id: 'mock-pu2', shop_id: shopId, product_id: 'mock-p2', supplier_id: 'mock-s2', quantity: 80, cost_per_unit: 4.50, total_cost: 360.00, purchase_date: '2026-05-21', notes: 'Fresh farm collection' },
            { id: 'mock-pu3', shop_id: shopId, product_id: 'mock-p3', supplier_id: 'mock-s1', quantity: 20, cost_per_unit: 2.20, total_cost: 44.00, purchase_date: '2026-05-22', notes: 'Weekly snack delivery' },
            { id: 'mock-pu4', shop_id: shopId, product_id: 'mock-p6', supplier_id: 'mock-s3', quantity: 40, cost_per_unit: 8.00, total_cost: 320.00, purchase_date: '2026-05-24', notes: 'Premium cooking oil replenishment' }
        ];

        const sales = [
            { id: 'mock-sa1', shop_id: shopId, invoice_no: 'INV-2026-001', product_id: 'mock-p1', customer_id: 'mock-c1', quantity: 2, unit_price: 19.99, discount_amount: 0, total_revenue: 39.98, estimated_profit: 15.98, is_credit: false, amount_paid: 39.98, seasonal_offer: 'None', sale_date: '2026-05-23', created_at: '2026-05-23T10:00:00Z' },
            { id: 'mock-sa2', shop_id: shopId, invoice_no: 'INV-2026-002', product_id: 'mock-p3', customer_id: 'mock-c2', quantity: 5, unit_price: 4.99, discount_amount: 1.00, total_revenue: 23.95, estimated_profit: 11.95, is_credit: false, amount_paid: 23.95, seasonal_offer: 'None', sale_date: '2026-05-23', created_at: '2026-05-23T14:30:00Z' },
            { id: 'mock-sa3', shop_id: shopId, invoice_no: 'INV-2026-003', product_id: 'mock-p2', customer_id: null, quantity: 4, unit_price: 8.50, discount_amount: 0, total_revenue: 34.00, estimated_profit: 16.00, is_credit: false, amount_paid: 34.00, seasonal_offer: 'None', sale_date: '2026-05-24', created_at: '2026-05-24T09:15:00Z' },
            { id: 'mock-sa4', shop_id: shopId, invoice_no: 'INV-2026-004', product_id: 'mock-p4', customer_id: 'mock-c3', quantity: 3, unit_price: 5.50, discount_amount: 2.00, total_revenue: 14.50, estimated_profit: 7.20, is_credit: false, amount_paid: 14.50, seasonal_offer: 'None', sale_date: '2026-05-24', created_at: '2026-05-24T12:00:00Z' },
            { id: 'mock-sa5', shop_id: shopId, invoice_no: 'INV-2026-005', product_id: 'mock-p5', customer_id: 'mock-c4', quantity: 4, unit_price: 3.49, discount_amount: 1.00, total_revenue: 12.96, estimated_profit: 5.76, is_credit: false, amount_paid: 12.96, seasonal_offer: 'None', sale_date: '2026-05-29', created_at: '2026-05-29T16:45:00Z' }
        ];

        await this.setLocalItem('rf_mock_products', products);
        await this.setLocalItem('rf_mock_suppliers', suppliers);
        await this.setLocalItem('rf_mock_customers', customers);
        await this.setLocalItem('rf_mock_expenses', expenses);
        await this.setLocalItem('rf_mock_purchases', purchases);
        await this.setLocalItem('rf_mock_sales', sales);
        await this.setLocalItem('rf_mock_returns', []);
        await this.setLocalItem('rf_mock_payments', []);
    }

    // ==========================================
    // INVENTORY
    // ==========================================
    async addInventory(code, name, cost, sell, unit, stock, category, minStock) {
        if (this.isMock) {
            code = code.trim().toUpperCase();
            name = name.trim();
            if (!code || !name || cost <= 0 || sell <= 0) throw new Error("All fields required. Prices must be positive.");

            const products = await this.getLocalItem('rf_mock_products', '[]');
            if (products.some(p => p.shop_id === this.profile.shop_id && p.product_code === code)) {
                throw new Error(`Product Code "${code}" already exists!`);
            }

            const newProduct = {
                id: 'mock-prod-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                product_code: code,
                name: name,
                category: category || 'General',
                cost_price: Number(cost),
                selling_price: Number(sell),
                stock: Number(stock) || 0,
                unit_type: unit || 'pcs',
                low_stock_threshold: Number(minStock) || 5
            };
            products.push(newProduct);
            await this.setLocalItem('rf_mock_products', products);
            await this.loadAllData();
            return;
        }

        code = code.trim().toUpperCase();
        name = name.trim();
        if (!code || !name || cost <= 0 || sell <= 0) throw new Error("All fields required. Prices must be positive.");

        const { error } = await window.supabaseClient
            .from('products')
            .insert({
                shop_id: this.profile.shop_id,
                product_code: code,
                name: name,
                category: category || 'General',
                cost_price: Number(cost),
                selling_price: Number(sell),
                stock: Number(stock) || 0,
                unit_type: unit || 'pcs',
                low_stock_threshold: Number(minStock) || 5
            });

        if (error) {
            if (error.code === '23505') throw new Error(`Product Code "${code}" already exists!`);
            throw error;
        }
        await this.loadAllData();
    }

    async deleteInventory(index) {
        if (this.isMock) {
            const item = this.inventory[index];
            if (!item) return;

            const products = await this.getLocalItem('rf_mock_products', '[]');
            const updated = products.filter(p => p.id !== item.uuid);
            await this.setLocalItem('rf_mock_products', updated);
            await this.loadAllData();
            return;
        }

        const item = this.inventory[index];
        if (!item) return;

        // Verify ledger histories
        const { data: saleMatches } = await window.supabaseClient
            .from('sales')
            .select('id')
            .eq('product_id', item.uuid)
            .limit(1);

        const { data: purchaseMatches } = await window.supabaseClient
            .from('purchases')
            .select('id')
            .eq('product_id', item.uuid)
            .limit(1);

        if ((saleMatches && saleMatches.length > 0) || (purchaseMatches && purchaseMatches.length > 0)) {
            throw new Error(`Cannot delete "${item.name}" — it has existing transaction histories.`);
        }

        const { error } = await window.supabaseClient
            .from('products')
            .delete()
            .eq('id', item.uuid);

        if (error) throw error;
        await this.loadAllData();
    }

    // ==========================================
    // SUPPLIERS
    // ==========================================
    async addSupplier(name, phone, address, notes) {
        if (this.isMock) {
            name = name.trim();
            if (!name) throw new Error("Supplier name is required.");

            const suppliers = await this.getLocalItem('rf_mock_suppliers', '[]');
            const newSup = {
                id: 'mock-sup-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                name,
                phone: phone || '',
                address: address || '',
                notes: notes || ''
            };
            suppliers.push(newSup);
            await this.setLocalItem('rf_mock_suppliers', suppliers);
            await this.loadAllData();
            return;
        }

        name = name.trim();
        if (!name) throw new Error("Supplier name is required.");

        const { error } = await window.supabaseClient
            .from('suppliers')
            .insert({
                shop_id: this.profile.shop_id,
                name,
                phone: phone || '',
                address: address || '',
                notes: notes || ''
            });

        if (error) throw error;
        await this.loadAllData();
    }

    async deleteSupplier(index) {
        if (this.isMock) {
            const sup = this.suppliers[index];
            if (!sup) return;

            const suppliers = await this.getLocalItem('rf_mock_suppliers', '[]');
            const updated = suppliers.filter(s => s.id !== sup.id);
            await this.setLocalItem('rf_mock_suppliers', updated);
            await this.loadAllData();
            return;
        }

        const sup = this.suppliers[index];
        if (!sup) return;

        const { data: purchaseMatches } = await window.supabaseClient
            .from('purchases')
            .select('id')
            .eq('supplier_id', sup.id)
            .limit(1);

        if (purchaseMatches && purchaseMatches.length > 0) {
            throw new Error(`Cannot delete "${sup.name}" — linked to existing purchases.`);
        }

        const { error } = await window.supabaseClient
            .from('suppliers')
            .delete()
            .eq('id', sup.id);

        if (error) throw error;
        await this.loadAllData();
    }

    getSupplierPurchases(supplierId) {
        return this.purchases.filter(p => p.supplierId === supplierId);
    }

    getSupplierOutstanding(supplierId) {
        const purchases = this.getSupplierPurchases(supplierId);
        const totalCost = purchases.reduce((s, p) => s + p.totalCost, 0);
        
        const returnRefunds = this.purchaseReturns
            .filter(r => r.supplierId === supplierId || purchases.some(p => p.productId === r.productId))
            .reduce((s, r) => s + r.amount, 0);

        return totalCost - returnRefunds;
    }

    // ==========================================
    // CUSTOMERS
    // ==========================================
    async addCustomer(name, phone, address) {
        if (this.isMock) {
            name = name.trim();
            if (!name) throw new Error("Customer name is required.");

            const customers = await this.getLocalItem('rf_mock_customers', '[]');
            const newCust = {
                id: 'mock-cust-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                name,
                phone: phone || '',
                total_due: 0
            };
            customers.push(newCust);
            await this.setLocalItem('rf_mock_customers', customers);
            await this.loadAllData();
            return;
        }

        name = name.trim();
        if (!name) throw new Error("Customer name is required.");

        const { error } = await window.supabaseClient
            .from('customers')
            .insert({
                shop_id: this.profile.shop_id,
                name,
                phone: phone || '',
                total_due: 0
            });

        if (error) throw error;
        await this.loadAllData();
    }

    async deleteCustomer(index) {
        if (this.isMock) {
            const cust = this.customers[index];
            if (!cust) return;

            const customers = await this.getLocalItem('rf_mock_customers', '[]');
            const updated = customers.filter(c => c.id !== cust.id);
            await this.setLocalItem('rf_mock_customers', updated);
            await this.loadAllData();
            return;
        }

        const cust = this.customers[index];
        if (!cust) return;

        const { data: saleMatches } = await window.supabaseClient
            .from('sales')
            .select('id')
            .eq('customer_id', cust.id)
            .limit(1);

        if (saleMatches && saleMatches.length > 0) {
            throw new Error(`Cannot delete "${cust.name}" — linked to existing credit sales.`);
        }

        const { error } = await window.supabaseClient
            .from('customers')
            .delete()
            .eq('id', cust.id);

        if (error) throw error;
        await this.loadAllData();
    }

    getCustomerDue(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        return customer ? Number(customer.total_due) : 0;
    }

    getTotalOutstandingDues() {
        return this.customers.reduce((s, c) => s + Number(c.total_due), 0);
    }

    // ==========================================
    // PAYMENTS (Collection)
    // ==========================================
    async addPayment(date, customerId, amount, note) {
        if (!date || !customerId || amount <= 0) throw new Error("Date, customer and amount required.");
        
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) throw new Error("Customer not found.");

        const outstanding = Number(customer.total_due);
        if (amount > outstanding) throw new Error(`Collection ৳${amount} exceeds outstanding due ৳${outstanding.toLocaleString()}`);

        if (this.isMock) {
            const payments = await this.getLocalItem('rf_mock_payments', '[]');
            const newPayment = {
                id: 'mock-pay-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                customer_id: customerId,
                amount: Number(amount),
                payment_date: date,
                note: note || ''
            };
            payments.push(newPayment);
            await this.setLocalItem('rf_mock_payments', payments);

            // Update customer total_due
            const customers = await this.getLocalItem('rf_mock_customers', '[]');
            const custIdx = customers.findIndex(c => c.id === customerId);
            if (custIdx >= 0) {
                customers[custIdx].total_due = Number(customers[custIdx].total_due) - Number(amount);
                await this.setLocalItem('rf_mock_customers', customers);
            }
            await this.loadAllData();
            return;
        }

        // Update total_due and insert payment log in a client-side transaction
        const { error: payErr } = await window.supabaseClient
            .from('payments')
            .insert({
                shop_id: this.profile.shop_id,
                customer_id: customerId,
                amount: Number(amount),
                payment_date: date,
                note: note || ''
            });

        if (payErr) throw payErr;

        const { error: custErr } = await window.supabaseClient
            .from('customers')
            .update({ total_due: outstanding - Number(amount) })
            .eq('id', customerId);

        if (custErr) throw custErr;

        await this.loadAllData();
    }

    async deletePayment(index) {
        const p = this.payments[index];
        if (!p) return;

        if (this.isMock) {
            // Restore customer due before deleting
            const customers = await this.getLocalItem('rf_mock_customers', '[]');
            const custIdx = customers.findIndex(c => c.id === p.customerId);
            if (custIdx >= 0) {
                customers[custIdx].total_due = Number(customers[custIdx].total_due) + Number(p.amount);
                await this.setLocalItem('rf_mock_customers', customers);
            }

            const payments = await this.getLocalItem('rf_mock_payments', '[]');
            const updated = payments.filter(pay => pay.id !== p.uuid);
            await this.setLocalItem('rf_mock_payments', updated);

            await this.loadAllData();
            return;
        }

        // Restore customer due before deleting
        const customer = this.customers.find(c => c.id === p.customerId);
        if (customer) {
            await window.supabaseClient
                .from('customers')
                .update({ total_due: Number(customer.total_due) + Number(p.amount) })
                .eq('id', p.customerId);
        }

        await window.supabaseClient
            .from('payments')
            .delete()
            .eq('id', p.uuid);

        await this.loadAllData();
    }

    // ==========================================
    // PURCHASES (Arrivals)
    // ==========================================
    async addPurchase(date, codeId, qty, supplierId) {
        if (!date || !codeId || qty <= 0) throw new Error("Date, product and quantity required.");
        
        const product = this.inventory.find(p => p.id === codeId);
        if (!product) throw new Error("Product not found in inventory.");

        const totalCost = product.cost * qty;

        if (this.isMock) {
            const purchases = await this.getLocalItem('rf_mock_purchases', '[]');
            const newPurchase = {
                id: 'mock-pur-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                product_id: product.uuid,
                supplier_id: supplierId || null,
                quantity: Number(qty),
                cost_per_unit: product.cost,
                total_cost: totalCost,
                purchase_date: date,
                notes: 'Product Arrival Logged'
            };
            purchases.push(newPurchase);
            await this.setLocalItem('rf_mock_purchases', purchases);

            // Increment product stock
            const products = await this.getLocalItem('rf_mock_products', '[]');
            const prodIdx = products.findIndex(p => p.id === product.uuid);
            if (prodIdx >= 0) {
                products[prodIdx].stock = Number(products[prodIdx].stock) + Number(qty);
                await this.setLocalItem('rf_mock_products', products);
            }

            await this.loadAllData();
            return;
        }

        // 1. Log purchase record
        const { error: purErr } = await window.supabaseClient
            .from('purchases')
            .insert({
                shop_id: this.profile.shop_id,
                product_id: product.uuid,
                supplier_id: supplierId || null,
                quantity: Number(qty),
                cost_per_unit: product.cost,
                total_cost: totalCost,
                purchase_date: date,
                notes: 'Product Arrival Logged'
            });

        if (purErr) throw purErr;

        // 2. Increment product stock
        const { error: prodErr } = await window.supabaseClient
            .from('products')
            .update({ stock: product.stock + Number(qty) })
            .eq('id', product.uuid);

        if (prodErr) throw prodErr;

        await this.loadAllData();
    }

    async deletePurchase(index) {
        const p = this.purchases[index];
        if (!p) return;

        if (this.isMock) {
            // Decrement stock
            const products = await this.getLocalItem('rf_mock_products', '[]');
            const prodIdx = products.findIndex(x => x.id === p.productId);
            if (prodIdx >= 0) {
                products[prodIdx].stock = Math.max(0, Number(products[prodIdx].stock) - p.qty);
                await this.setLocalItem('rf_mock_products', products);
            }

            const purchases = await this.getLocalItem('rf_mock_purchases', '[]');
            const updated = purchases.filter(x => x.id !== p.uuid);
            await this.setLocalItem('rf_mock_purchases', updated);

            await this.loadAllData();
            return;
        }

        const product = this.inventory.find(x => x.uuid === p.productId);
        if (product) {
            // Decrement stock
            await window.supabaseClient
                .from('products')
                .update({ stock: Math.max(0, product.stock - p.qty) })
                .eq('id', p.productId);
        }

        await window.supabaseClient
            .from('purchases')
            .delete()
            .eq('id', p.uuid);

        await this.loadAllData();
    }

    // ==========================================
    // SALES (POS cart)
    // ==========================================
    async addSale(date, cartItems, isCredit, customerId, discountType = 'none', discountValue = 0, seasonalTag = '') {
        if (!date) throw new Error("Date is required.");
        if (!Array.isArray(cartItems) || cartItems.length === 0) throw new Error("Cart is empty.");

        // Check stock first
        cartItems.forEach(item => {
            const product = this.inventory.find(p => p.id === item.id);
            if (!product) throw new Error("Product not found.");
            if (product.stock < item.qty) {
                throw new Error(`Not enough stock for "${product.name}"! Available: ${product.stock} ${product.unit}`);
            }
        });

        let customer = null;
        if (isCredit) {
            if (!customerId) throw new Error("Select a customer for credit sales.");
            customer = this.customers.find(c => c.id === customerId);
            if (!customer) throw new Error("Customer not found.");
        }

        const invoiceNo = 'INV-' + Math.floor(100000 + Math.random() * 900000);
        let grossTotal = 0;
        cartItems.forEach(item => {
            const product = this.inventory.find(p => p.id === item.id);
            if (product) grossTotal += product.sell * item.qty;
        });

        let totalDiscount = 0;
        if (discountType === 'percent') {
            totalDiscount = grossTotal * (Number(discountValue) / 100);
        } else if (discountType === 'flat') {
            totalDiscount = Number(discountValue);
        }
        if (totalDiscount < 0) totalDiscount = 0;
        if (totalDiscount > grossTotal) totalDiscount = grossTotal;

        const netTotal = grossTotal - totalDiscount;

        if (this.isMock) {
            const sales = await this.getLocalItem('rf_mock_sales', '[]');
            const products = await this.getLocalItem('rf_mock_products', '[]');
            
            for (const item of cartItems) {
                const product = products.find(p => p.product_code === item.id);
                if (!product) continue;

                const itemGross = product.selling_price * item.qty;
                const itemDiscount = grossTotal > 0 ? totalDiscount * (itemGross / grossTotal) : 0;
                const itemNet = itemGross - itemDiscount;
                const itemProfit = itemNet - (product.cost_price * item.qty);

                const newSaleRow = {
                    id: 'mock-sale-' + Math.random().toString(36).substr(2, 9),
                    shop_id: this.profile.shop_id,
                    invoice_no: invoiceNo,
                    product_id: product.id,
                    customer_id: customerId || null,
                    quantity: Number(item.qty),
                    unit_price: product.selling_price,
                    discount_amount: itemDiscount,
                    total_revenue: itemNet,
                    estimated_profit: itemProfit,
                    is_credit: !!isCredit,
                    amount_paid: isCredit ? 0 : itemNet,
                    seasonal_offer: seasonalTag || '',
                    sale_date: date,
                    created_at: new Date().toISOString()
                };
                sales.push(newSaleRow);

                // Decrement stock
                product.stock = Math.max(0, Number(product.stock) - item.qty);
            }

            await this.setLocalItem('rf_mock_sales', sales);
            await this.setLocalItem('rf_mock_products', products);

            // Increase customer due if credit
            if (isCredit) {
                const customers = await this.getLocalItem('rf_mock_customers', '[]');
                const custIdx = customers.findIndex(c => c.id === customerId);
                if (custIdx >= 0) {
                    customers[custIdx].total_due = Number(customers[custIdx].total_due) + netTotal;
                    await this.setLocalItem('rf_mock_customers', customers);
                }
            }

            await this.loadAllData();
            return invoiceNo;
        }

        // Supabase mode
        for (const item of cartItems) {
            const product = this.inventory.find(p => p.id === item.id);
            const itemGross = product.sell * item.qty;
            const itemDiscount = grossTotal > 0 ? totalDiscount * (itemGross / grossTotal) : 0;
            const itemNet = itemGross - itemDiscount;
            const itemProfit = itemNet - (product.cost * item.qty);

            // 1. Insert Sales flat row
            const { error: saleErr } = await window.supabaseClient
                .from('sales')
                .insert({
                    shop_id: this.profile.shop_id,
                    invoice_no: invoiceNo,
                    product_id: product.uuid,
                    customer_id: customerId || null,
                    quantity: Number(item.qty),
                    unit_price: product.sell,
                    discount_amount: itemDiscount,
                    total_revenue: itemNet,
                    estimated_profit: itemProfit,
                    is_credit: !!isCredit,
                    amount_paid: isCredit ? 0 : itemNet,
                    seasonal_offer: seasonalTag || '',
                    sale_date: date
                });

            if (saleErr) throw saleErr;

            // 2. Decrement stock
            const { error: prodErr } = await window.supabaseClient
                .from('products')
                .update({ stock: product.stock - Number(item.qty) })
                .eq('id', product.uuid);

            if (prodErr) throw prodErr;
        }

        // 3. Increase customer due if credit sale
        if (isCredit && customer) {
            const { error: custErr } = await window.supabaseClient
                .from('customers')
                .update({ total_due: Number(customer.total_due) + netTotal })
                .eq('id', customer.id);

            if (custErr) throw custErr;
        }

        await this.loadAllData();
        return invoiceNo;
    }

    async deleteSale(index) {
        const invoice = this.sales[index];
        if (!invoice) return;

        if (this.isMock) {
            const sales = await this.getLocalItem('rf_mock_sales', '[]');
            const products = await this.getLocalItem('rf_mock_products', '[]');
            
            let totalRefund = 0;
            for (const item of invoice.items) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    product.stock = Number(product.stock) + item.qty;
                }
                totalRefund += item.totalSales;
            }

            // Remove rows from sales
            const updatedSales = sales.filter(s => s.invoice_no !== invoice.invoiceNo);
            
            await this.setLocalItem('rf_mock_sales', updatedSales);
            await this.setLocalItem('rf_mock_products', products);

            // Reduce dues if it was a credit sale
            if (invoice.isCredit && invoice.customerId) {
                const customers = await this.getLocalItem('rf_mock_customers', '[]');
                const custIdx = customers.findIndex(c => c.id === invoice.customerId);
                if (custIdx >= 0) {
                    customers[custIdx].total_due = Math.max(0, Number(customers[custIdx].total_due) - totalRefund);
                    await this.setLocalItem('rf_mock_customers', customers);
                }
            }

            await this.loadAllData();
            return;
        }

        // Restore stock and reduce customer dues before deleting
        let totalRefund = 0;
        for (const item of invoice.items) {
            const product = this.inventory.find(p => p.uuid === item.productId);
            if (product) {
                await window.supabaseClient
                    .from('products')
                    .update({ stock: product.stock + item.qty })
                    .eq('id', item.productId);
            }
            totalRefund += item.totalSales;

            // Delete individual sales row
            await window.supabaseClient
                .from('sales')
                .delete()
                .eq('id', item.uuid);
        }

        // Reduce dues if it was a credit sale
        if (invoice.isCredit && invoice.customerId) {
            const customer = this.customers.find(c => c.id === invoice.customerId);
            if (customer) {
                await window.supabaseClient
                    .from('customers')
                    .update({ total_due: Math.max(0, Number(customer.total_due) - totalRefund) })
                    .eq('id', invoice.customerId);
            }
        }

        await this.loadAllData();
    }

    // ==========================================
    // EXPENSES
    // ==========================================
    async addExpense(date, category, amount, note) {
        if (!date || !category || amount <= 0) throw new Error("Date, category and amount required.");

        if (this.isMock) {
            const expenses = await this.getLocalItem('rf_mock_expenses', '[]');
            const newExp = {
                id: 'mock-exp-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                category: category,
                amount: Number(amount),
                note: note || '',
                expense_date: date
            };
            expenses.push(newExp);
            await this.setLocalItem('rf_mock_expenses', expenses);
            await this.loadAllData();
            return;
        }

        const { error } = await window.supabaseClient
            .from('expenses')
            .insert({
                shop_id: this.profile.shop_id,
                category: category,
                amount: Number(amount),
                note: note || '',
                expense_date: date
            });

        if (error) throw error;
        await this.loadAllData();
    }

    async deleteExpense(index) {
        const e = this.expenses[index];
        if (!e) return;

        if (this.isMock) {
            const expenses = await this.getLocalItem('rf_mock_expenses', '[]');
            const updated = expenses.filter(x => x.id !== e.uuid);
            await this.setLocalItem('rf_mock_expenses', updated);
            await this.loadAllData();
            return;
        }

        const { error } = await window.supabaseClient
            .from('expenses')
            .delete()
            .eq('id', e.uuid);

        if (error) throw error;
        await this.loadAllData();
    }

    // ==========================================
    // GENERAL RETURNS (Sales & Purchase)
    // ==========================================
    async addGeneralReturn(date, type, codeId, qty, amount, reason) {
        if (!date || !type || !codeId || qty <= 0 || amount < 0) throw new Error("Missing return details.");

        const product = this.inventory.find(p => p.id === codeId);
        if (!product) throw new Error("Product not found.");

        if (type === 'purchase_return' && product.stock < qty) {
            throw new Error(`Not enough stock to return! Available: ${product.stock} ${product.unit}`);
        }

        if (this.isMock) {
            const returns = await this.getLocalItem('rf_mock_returns', '[]');
            const newReturn = {
                id: 'mock-ret-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                type: type,
                product_id: product.uuid,
                quantity: Number(qty),
                amount: Number(amount),
                reason: reason || '',
                return_date: date
            };
            returns.push(newReturn);
            await this.setLocalItem('rf_mock_returns', returns);

            // Adjust stock
            const products = await this.getLocalItem('rf_mock_products', '[]');
            const prodIdx = products.findIndex(p => p.id === product.uuid);
            if (prodIdx >= 0) {
                const stockDiff = type === 'sales_return' ? Number(qty) : -Number(qty);
                products[prodIdx].stock = Math.max(0, Number(products[prodIdx].stock) + stockDiff);
                await this.setLocalItem('rf_mock_products', products);
            }

            await this.loadAllData();
            return;
        }

        // 1. Insert return row
        const { error: retErr } = await window.supabaseClient
            .from('returns')
            .insert({
                shop_id: this.profile.shop_id,
                type: type,
                product_id: product.uuid,
                quantity: Number(qty),
                amount: Number(amount),
                reason: reason || '',
                return_date: date
            });

        if (retErr) throw retErr;

        // 2. Adjust stock balances
        const stockDiff = type === 'sales_return' ? Number(qty) : -Number(qty);
        const { error: prodErr } = await window.supabaseClient
            .from('products')
            .update({ stock: product.stock + stockDiff })
            .eq('id', product.uuid);

        if (prodErr) throw prodErr;

        await this.loadAllData();
    }

    async deleteGeneralReturn(uuid, type, productId, qty) {
        if (this.isMock) {
            // Reverse stock changes
            const products = await this.getLocalItem('rf_mock_products', '[]');
            const prodIdx = products.findIndex(p => p.id === productId);
            if (prodIdx >= 0) {
                const stockDiff = type === 'sales_return' ? -Number(qty) : Number(qty);
                products[prodIdx].stock = Math.max(0, Number(products[prodIdx].stock) + stockDiff);
                await this.setLocalItem('rf_mock_products', products);
            }

            const returns = await this.getLocalItem('rf_mock_returns', '[]');
            const updated = returns.filter(r => r.id !== uuid);
            await this.setLocalItem('rf_mock_returns', updated);

            await this.loadAllData();
            return;
        }

        // Reverse stock changes before delete
        const product = this.inventory.find(p => p.uuid === productId);
        if (product) {
            const stockDiff = type === 'sales_return' ? -Number(qty) : Number(qty);
            await window.supabaseClient
                .from('products')
                .update({ stock: Math.max(0, product.stock + stockDiff) })
                .eq('id', productId);
        }

        await window.supabaseClient
            .from('returns')
            .delete()
            .eq('id', uuid);

        await this.loadAllData();
    }

    // ==========================================
    // BACKUPS & INVITATIONS
    // ==========================================
    async sendInvitation(email, role) {
        if (!email) throw new Error("Email required.");

        if (this.isMock) {
            const invitations = await this.getLocalItem('rf_mock_invitations', '[]');
            if (invitations.some(inv => inv.shop_id === this.profile.shop_id && inv.email.toLowerCase() === email.trim().toLowerCase())) {
                throw new Error(`Staff with email "${email}" has already been invited!`);
            }
            const newInvite = {
                id: 'mock-inv-' + Math.random().toString(36).substr(2, 9),
                shop_id: this.profile.shop_id,
                email: email.trim().toLowerCase(),
                role: role,
                created_at: new Date().toISOString()
            };
            invitations.push(newInvite);
            await this.setLocalItem('rf_mock_invitations', invitations);
            return;
        }
        
        const { error } = await window.supabaseClient
            .from('invitations')
            .insert({
                shop_id: this.profile.shop_id,
                email: email.trim().toLowerCase(),
                role: role
            });

        if (error) {
            if (error.code === '23505') throw new Error(`Staff with email "${email}" has already been invited!`);
            throw error;
        }
    }

    async updateShopInfo(name, owner, address, phone) {
        if (this.isMock) {
            const shops = await this.getLocalItem('rf_mock_shops', '[]');
            const shopIdx = shops.findIndex(s => s.id === this.profile.shop_id);
            if (shopIdx >= 0) {
                shops[shopIdx].name = name;
                shops[shopIdx].owner_name = owner;
                shops[shopIdx].address = address;
                shops[shopIdx].phone = phone;
                await this.setLocalItem('rf_mock_shops', shops);
            }
            this.shop = { id: this.profile.shop_id, name, owner_name: owner, address, phone };
            await this.loadAllData();
            return;
        }

        const { error } = await window.supabaseClient
            .from('shops')
            .update({ name, owner_name: owner, address, phone })
            .eq('id', this.profile.shop_id);

        if (error) throw error;
        await this.loadAllData();
    }

    // ==========================================
    // FINANCIAL CALCULATIONS (Dashboard cache helpers)
    // ==========================================
    getFinancials() {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Today Sales
        const todaySales = this.sales.filter(s => s.date === todayStr).reduce((s, x) => s + x.totalSales, 0);
        
        // Yesterday's Sales
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdaySales = this.sales.filter(s => s.date === yesterdayStr).reduce((s, x) => s + x.totalSales, 0);

        // Sales totals
        const totalSalesRevenue = this.sales.reduce((s, x) => s + x.totalSales, 0);
        const totalSalesReturnRefund = this.salesReturns.reduce((s, x) => s + x.totalRefund, 0);
        const effectiveSales = totalSalesRevenue - totalSalesReturnRefund;

        // Purchase investment totals
        const totalPurchaseCost = this.purchases.reduce((s, x) => s + x.totalCost, 0);
        const totalPurchaseReturnCredit = this.purchaseReturns.reduce((s, x) => s + x.totalCost, 0);
        const effectiveInvestment = totalPurchaseCost - totalPurchaseReturnCredit;

        // Expenses totals
        const totalExpenses = this.expenses.reduce((s, x) => s + x.amount, 0);

        // Profits
        const grossProfit = this.sales.reduce((s, x) => s + x.profit, 0);
        const netProfit = grossProfit - totalExpenses - totalSalesReturnRefund; // adjusted simply
        
        const outstandingDues = this.getTotalOutstandingDues();

        // 7-day Weekly Sales Trend Data
        const weeklyTrend = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            const dSales = this.sales.filter(s => s.date === dStr).reduce((sum, s) => sum + s.totalSales, 0);
            weeklyTrend.push({ date: dStr, amount: dSales });
        }

        // Top Selling Products All-Time or current month
        const topSellingAllTimeMap = {};
        this.sales.forEach(s => {
            s.items.forEach(item => {
                if (!topSellingAllTimeMap[item.id]) {
                    topSellingAllTimeMap[item.id] = { name: item.name, totalQty: 0, totalRevenue: 0 };
                }
                topSellingAllTimeMap[item.id].totalQty += item.qty;
                topSellingAllTimeMap[item.id].totalRevenue += item.totalSales;
            });
        });
        const top5Selling = Object.values(topSellingAllTimeMap)
            .sort((a, b) => b.totalQty - a.totalQty)
            .slice(0, 5);

        return {
            todaySales,
            yesterdaySales,
            totalSalesRevenue,
            effectiveSales,
            totalPurchaseCost,
            effectiveInvestment,
            totalExpenses,
            netProfit,
            outstandingDues,
            totalInventoryValuation: this.inventory.reduce((s, p) => s + (p.stock * p.sell), 0),
            totalInventoryQuantity: this.inventory.reduce((s, p) => s + p.stock, 0),
            lowStockCount: this.getLowStockItems().length,
            totalUniqueCustomers: this.customers.length,
            totalSuppliers: this.suppliers.length,
            weeklyTrend,
            top5Selling
        };
    }

    getLowStockItems() {
        return this.inventory.filter(p => p.stock <= (p.minStock || 10));
    }

    getSalesByCategory() {
        const map = {};
        this.sales.forEach(s => {
            s.items.forEach(item => {
                const product = this.inventory.find(p => p.id === item.id);
                const cat = product ? (product.category || 'General') : 'General';
                map[cat] = (map[cat] || 0) + item.totalSales;
            });
        });
        return map;
    }

    getExpensesByCategory() {
        const map = {};
        this.expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
        return map;
    }

    getMonthlyExpenses() {
        const map = {};
        this.expenses.forEach(e => { const m = e.date.substring(0, 7); map[m] = (map[m] || 0) + e.amount; });
        return map;
    }

    // Reports aggregates
    getMonthlyReport(month) {
        const salesInMonth = this.sales.filter(s => s.date.startsWith(month));
        const purchasesInMonth = this.purchases.filter(p => p.date.startsWith(month));
        const expensesInMonth = this.expenses.filter(e => e.date.startsWith(month));
        
        const totalSales = salesInMonth.reduce((s, x) => s + x.totalSales, 0);
        const totalPurchases = purchasesInMonth.reduce((s, x) => s + x.totalCost, 0);
        const totalExpenses = expensesInMonth.reduce((s, x) => s + x.amount, 0);
        
        const grossProfit = salesInMonth.reduce((s, x) => s + x.profit, 0);
        const netProfit = grossProfit - totalExpenses;

        return {
            month, totalSales, totalPurchases, totalExpenses, netProfit,
            salesCount: salesInMonth.length,
            purchaseCount: purchasesInMonth.length
        };
    }

    getTopSellingProducts(month, limit = 5) {
        const salesInMonth = this.sales.filter(s => s.date.startsWith(month));
        const map = {};
        salesInMonth.forEach(s => {
            s.items.forEach(item => {
                if (!map[item.id]) {
                    map[item.id] = { name: item.name, totalQty: 0, totalRevenue: 0, totalProfit: 0 };
                }
                map[item.id].totalQty += item.qty;
                map[item.id].totalRevenue += item.totalSales;
                map[item.id].totalProfit += item.profit;
            });
        });
        return Object.values(map).sort((a,b) => b.totalRevenue - a.totalRevenue).slice(0, limit);
    }

    getAllMonths() {
        const months = new Set();
        this.sales.forEach(s => months.add(s.date.substring(0, 7)));
        this.purchases.forEach(p => months.add(p.date.substring(0, 7)));
        this.expenses.forEach(e => months.add(e.date.substring(0, 7)));
        return [...months].sort().reverse();
    }
}

window.store = new AppStore();
