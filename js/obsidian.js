function pad2 (n) {
    return n < 10 ? `0${n}` : `${n}`;
}

function frmattedCurrentTime () {
    if (window.theme_utils) return theme_utils.get_current_localized_time();
    
    const now = new Date();
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function userColor (str) {
    let rand = 0;
    for (const char of str) {
        rand = char.charCodeAt(0) + ((rand << 5) - rand);
    }
    const deg = ((rand % 360) + 360) % 360;
    return `hsl(${deg}, 70%, 60%)`;
}

window.ObsidianTheme = class ObsidianTheme {
    selectUser (username) {
        const userIdx = lightdm.users.findIndex(user => user.name === username);
        const user = lightdm.users[userIdx]

        console.log('-> select user %s', username);

        if (this.selectedUser && this.authInProgress) {
            lightdm.cancel_authentication();
        }
        lightdm.start_authentication(username);
        this.selectedUser = user;
        this.authInProgress = true;

        document.querySelectorAll('.user').forEach(elem => elem.classList.remove('selected'));
        document.getElementById(`user-${username}`).classList.add('selected');

        const remOffset = (userIdx * -9) - 6;
        document.getElementById('users').style.marginLeft = `${remOffset}rem`;

        const passwdElem = document.getElementById('password');
        passwdElem.classList.remove('error');

        this.updateSession();
    }

    updateSession () {
        const session = lightdm.sessions.find(sess => sess.key === this.selectedUser.session) || lightdm.default_session;
        const sessTextElem = document.getElementById('sessions-current');
        sessTextElem.innerText = session.name || session.key;
    }

    selectLeft () {
        const selIdx = lightdm.users.findIndex(user => user.name === this.selectedUser.name);
        const nextIdx = selIdx <= 0 ? 0 : selIdx - 1;
        this.selectUser(lightdm.users[nextIdx].name);
    }

    selectRight () {
        const selIdx = lightdm.users.findIndex(user => user.name === this.selectedUser.name);
        const nextIdx = selIdx >= lightdm.users.length - 1 ? lightdm.users.length - 1 : selIdx + 1;
        this.selectUser(lightdm.users[nextIdx].name);
    }

    buildUserList (firstUser) {
        const userListElem = document.getElementById('users');
        while (userListElem.firstChild) {
            userListElem.firstChild.remove();
        }

        const tpl = document.getElementById('tpl-user');
        lightdm.users.forEach((user, idx) => {
            const fragment = document.importNode(tpl.content, true);
            const userElem = fragment.querySelector('.user');
            userElem.id = `user-${user.name}`;
            if (user.name === firstUser) {
                userElem.classList.add('selected');
            }

            const userImgWrapElem = userElem.querySelector('.user-image-wrap');
            userImgWrapElem.style.backgroundColor = userColor(user.name);

            const userImgElem = userElem.querySelector('.user-image');
            userImgElem.src = user.image;

            const userInitial = userElem.querySelector('.user-initial');
            userInitial.innerText = user.name[0].toUpperCase();

            const userNameElem = userElem.querySelector('.user-name');
            userNameElem.innerText = user.display_name || user.name;

            const userSelectElem = userElem.querySelector('.user-select');
            userSelectElem.addEventListener('click', () => this.selectUser(user.name));

            userListElem.appendChild(fragment);
        });
    }

    updateDateTime () {
        const datetimeElem = document.getElementById('datetime');
        datetimeElem.innerText = frmattedCurrentTime();
    }

    initPowerButtons () {
        const powerElem = document.getElementById('power');

        const powerBtnElem = document.getElementById('power-trigger');
        powerBtnElem.addEventListener('click', () => {
            powerElem.classList.add('open');
        });

        const powerMenuElem = document.getElementById('power-menu');
        powerMenuElem.addEventListener('mouseleave', () => {
           powerElem.classList.remove('open');
        });


        for (const action of ['suspend', 'hibernate', 'restart', 'shutdown']) {
            const elem = document.getElementById(`power-${action}`);
            if (lightdm[`can_${action}`]) {
                elem.addEventListener('click', () => lightdm[action]());
                elem.style.display = undefined;
            } else {
                elem.style.display = 'none';
            }
        }
    }

    initPasswordForm () {
        const formElem = document.getElementById('password-form');
        formElem.addEventListener('submit', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();

            const passwdElem = document.getElementById('password');
            this.disablePasswordField();
            lightdm.provide_secret(passwdElem.value);

            passwdElem.addEventListener('keypress', () => {
                passwdElem.classList.remove('error');
            });
        });
    }

    activatePasswordField () {
        const passwdElem = document.getElementById('password');
        passwdElem.disabled = false;
        passwdElem.value = '';
        passwdElem.focus();
    }

    disablePasswordField () {
        const passwdElem = document.getElementById('password');
        passwdElem.disabled = true;
    }

    onPrompt (prompt) {
        if (prompt.startsWith('Password:')) {
            console.log('   prompt for password...');
            this.activatePasswordField();
        } else {
            console.debug('unknown prompt (%s)', prompt);
        }
    }

    onError (error) {
        console.error(error);
    }

    onAuth (args) {
        this.authInProgress = false;

        console.log(' * auth complete: %s', lightdm.is_authenticated)

        if (lightdm.is_authenticated) {
            lightdm.login(this.selectedUser.name, lightdm.sessions[0].key);
    
        } else {
            this.selectUser(this.selectedUser.name);

            const passwdElem = document.getElementById('password');
            passwdElem.classList.add('error');
        }
    }

    initDateTimeUpdater () {
        const updater = () => {
            const now = Date.now();
            this.updateDateTime();

            setTimeout(updater, 60001 - (now % 60000));
        }

        updater();
    }

    init () {
        console.log('=== [Obsidian Theme] ===');
        const firstUser = lightdm.authentication_user || lightdm.select_user_hint || lightdm.users[0].name;

        this.initDateTimeUpdater();
        this.buildUserList(firstUser);
        this.initPowerButtons();
        this.initPasswordForm();

        window.show_prompt = (...args) => this.onPrompt(...args);
        window.show_error = (...args) => this.onError(...args);
        window.authentication_complete = (...args) => this.onAuth(...args);

        this.selectUser(firstUser);
    }
};