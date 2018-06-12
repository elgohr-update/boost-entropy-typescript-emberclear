import Component from '@ember/component';
import { action } from '@ember-decorators/object';

export default class ModalContainer extends Component {
  isActive = false

  @action
  toggle(this: ModalContainer) {
    this.set('isActive', !this.isActive);
  }
}