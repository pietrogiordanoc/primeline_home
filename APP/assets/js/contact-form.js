const contactData = globalThis.PRIME_LINE_CONTACT_DATA;
const contactForm = document.querySelector('.contact-form');

if (contactData && contactForm) {
  const appendOptions = (select, options) => {
    options.forEach((item) => {
      select.add(new Option(item.name, item.code));
    });
  };
  const appendChoices = (select, choices) => {
    choices.forEach((choice) => select.add(new Option(choice, choice)));
  };

  const inquiryType = contactForm.querySelector('#contactInquiryType');
  const businessType = contactForm.querySelector('#contactBusinessType');
  const country = contactForm.querySelector('#contactCountry');
  const stateSelect = contactForm.querySelector('#contactStateSelect');
  const provinceInput = contactForm.querySelector('#contactProvince');
  const stateLabel = contactForm.querySelector('#contactStateLabel');
  const stateHint = contactForm.querySelector('#contactStateHint');

  appendChoices(inquiryType, contactData.inquiryTypes);
  appendChoices(businessType, contactData.businessTypes);
  country.replaceChildren();
  appendOptions(country, contactData.countries);
  country.value = 'US';
  country.selectedOptions[0].defaultSelected = true;
  appendOptions(stateSelect, contactData.usStates);

  const updateStateField = (clearValue = false) => {
    const isUnitedStates = country.value === 'US';
    if (clearValue) {
      stateSelect.value = '';
      provinceInput.value = '';
    }
    stateSelect.hidden = !isUnitedStates;
    stateSelect.disabled = !isUnitedStates;
    stateSelect.required = isUnitedStates;
    provinceInput.hidden = isUnitedStates;
    provinceInput.disabled = isUnitedStates;
    provinceInput.required = false;
    stateLabel.textContent = isUnitedStates ? 'State' : 'State / Province (Optional)';
    stateHint.textContent = isUnitedStates
      ? 'Required for United States. Select a state or DC.'
      : 'Enter a state, province, or region if applicable.';
  };

  country.addEventListener('change', () => updateStateField(true));
  contactForm.addEventListener('reset', () => {
    requestAnimationFrame(() => {
      country.value = 'US';
      updateStateField(true);
    });
  });
  updateStateField();
} else {
  console.error('Contact form data could not be initialized.');
}
