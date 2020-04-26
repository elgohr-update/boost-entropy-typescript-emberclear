import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import CurrentUserService from 'emberclear/services/current-user';

import StoreService from '@ember-data/store';
import Toast from 'emberclear/services/toast';
import Settings from 'emberclear/services/settings';

import RouterService from '@ember/routing/router-service';
import { naclBoxPrivateKeyFromMnemonic } from 'emberclear/workers/crypto/utils/mnemonic';
import { derivePublicKey, generateSigningKeys } from 'emberclear/workers/crypto/utils/nacl';
import { dropTask } from 'ember-concurrency-decorators';
import { taskFor } from 'emberclear/utils/ember-concurrency';

export default class LoginForm extends Component<{}> {
  @service currentUser!: CurrentUserService;
  @service settings!: Settings;
  @service toast!: Toast;
  @service router!: RouterService;
  @service store!: StoreService;

  @tracked mnemonic = '';
  @tracked name = '';
  @tracked hasTransferStarted = false;

  get contacts() {
    return this.store.peekAll('contact');
  }

  get isLoggedIn() {
    return this.currentUser.isLoggedIn;
  }

  @dropTask
  *login() {
    try {
      const name = this.name;
      const privateKey = yield naclBoxPrivateKeyFromMnemonic(this.mnemonic);
      const publicKey = yield derivePublicKey(privateKey);
      const { publicSigningKey, privateSigningKey } = yield generateSigningKeys();

      yield this.currentUser.setIdentity(
        name,
        privateKey,
        publicKey,
        privateSigningKey,
        publicSigningKey
      );

      this.router.transitionTo('chat');
    } catch (e) {
      console.error(e);
      this.toast.error('There was a problem logging in...');
    }
  }

  @dropTask
  *uploadSettings(data: string) {
    try {
      yield this.settings.import(data);

      this.router.transitionTo('settings');
    } catch (e) {
      console.error(e);
      this.toast.error('There was a problem processing your file...');
    }
  }

  @action
  updateTransferStatus(nextValue: boolean) {
    this.hasTransferStarted = nextValue;
  }

  @action
  onChooseFile(data: string) {
    taskFor(this.uploadSettings).perform(data);
  }

  @action
  onSubmit() {
    taskFor(this.login).perform();
  }
}
