import { mount } from '@vue/test-utils';

import GSelect from '~/components/ui/GSelect.vue';

describe('GSelect', () => {
  it('emits update:modelValue when selection changes', async () => {
    const wrapper = mount(GSelect, {
      props: {
        modelValue: 'continents',
      },
      slots: {
        default: `
          <option value="continents">Continents</option>
          <option value="archipelago">Archipelago</option>
        `,
      },
    });

    await wrapper.get('select').setValue('archipelago');

    expect(wrapper.emitted('update:modelValue')).toEqual([['archipelago']]);
  });
});
