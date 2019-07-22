function pad2 (n) {
    return n < 10 ? `0${n}` : `${n}`;
}

function formatDate (date) {
    const year = date.getYear() + 1900;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatTime (date) {
    const hour = date.getHours();
    const min = date.getMinutes();
    return `${pad2(hour)}:${pad2(min)}`;
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

    buildUserList () {
        const userListElem = document.getElementById('users');
        while (userListElem.firstChild) {
            userListElem.firstChild.remove();
        }

        const tpl = document.getElementById('tpl-user')
        for (const user of lightdm.users) {
            const fragment = document.importNode(tpl.content, true);
            const userElem = fragment.querySelector('.user');
            userElem.id = `user-${user.name}`;

            const userImgElem = userElem.querySelector('.user-image');
            userImgElem.src = user.image || 'img/user.png';

            const userNameElem = userElem.querySelector('.user-name');
            userNameElem.innerText = user.display_name || user.name;

            const userSelectElem = userElem.querySelector('.user-select');
            userSelectElem.addEventListener('click', () => this.selectUser(user.name));

            userListElem.appendChild(fragment);
        }
    }

    updateDateTime () {
        const date = new Date();

        const datetimeElem = document.getElementById('datetime');
        datetimeElem.dateTime = date.toISOString();

        const dateElem = document.getElementById('datetime-date');
        dateElem.innerText = formatDate(date);

        const timeElem = document.getElementById('datetime-time');
        timeElem.innerText = formatTime(date);
    }

    initPowerButtons () {
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

        this.initDateTimeUpdater();
        this.buildUserList();
        this.initPowerButtons();
        this.initPasswordForm();

        window.show_prompt = (...args) => this.onPrompt(...args);
        window.show_error = (...args) => this.onError(...args);
        window.authentication_complete = (...args) => this.onAuth(...args);

        this.selectUser(lightdm.authentication_user || lightdm.select_user_hint || lightdm.users[0].name);
    }
};