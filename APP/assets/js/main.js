// Prime Line - shared interactions (header solid state, reveal-on-scroll, nav toggle)
document.addEventListener('DOMContentLoaded', () => {
  const spotLightbox = document.createElement('div');
  spotLightbox.className = 'spot-lightbox';
  spotLightbox.setAttribute('aria-hidden', 'true');
  spotLightbox.innerHTML = `
    <button type="button" class="spot-lightbox-close" aria-label="Close image">&times;</button>
    <img class="spot-lightbox-image" alt="">
  `;
  document.body.appendChild(spotLightbox);
  const spotLightboxImage = spotLightbox.querySelector('.spot-lightbox-image');
  const closeSpotLightbox = () => {
    spotLightbox.classList.remove('is-open');
    spotLightbox.setAttribute('aria-hidden', 'true');
    spotLightboxImage.removeAttribute('src');
  };
  document.addEventListener('click', (e) => {
    const trioSection = e.target.closest('section[class*="-trio"]');
    const trioCard = e.target.closest('article, a');
    if (trioSection && trioCard && trioSection.contains(trioCard)) {
      e.preventDefault();
      const image = trioCard.querySelector('img');
      if (!image) return;
      spotLightboxImage.src = image.currentSrc || image.src;
      spotLightboxImage.alt = image.alt;
      spotLightbox.classList.add('is-open');
      spotLightbox.setAttribute('aria-hidden', 'false');
      return;
    }
    if (e.target.closest('.banner-slider, .slider-arrow, .catalog-choice-card, .brand-logo')) return;
    const image = e.target.closest('img');
    if (!image) return;
    if (e.target.closest('a')) e.preventDefault();
    spotLightboxImage.src = image.currentSrc || image.src;
    spotLightboxImage.alt = image.alt;
    spotLightbox.classList.add('is-open');
    spotLightbox.setAttribute('aria-hidden', 'false');
  });
  spotLightbox.addEventListener('click', (e) => {
    if (e.target === spotLightbox || e.target.closest('.spot-lightbox-close')) closeSpotLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSpotLightbox();
  });

  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      if (document.body.classList.contains('mobile-curtain-open')) return;
      header.classList.toggle('is-solid', window.scrollY > 60);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  }

  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    const updateBackToTop = () => {
      if (document.body.classList.contains('mobile-curtain-open')) return;
      backToTop.classList.toggle('is-visible', window.scrollY > 400);
    };
    updateBackToTop();
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('is-open'));
  }

  const simpleHeader = document.querySelector('.site-header-simple');
  if (simpleHeader) {
    const onScrollSimple = () => {
      if (document.body.classList.contains('mobile-curtain-open')) return;
      simpleHeader.classList.toggle('is-scrolled', window.scrollY > 10);
    };
    onScrollSimple();
    window.addEventListener('scroll', onScrollSimple, { passive: true });
  }

  const menuToggle = document.querySelector('.menu-toggle');
  const navPanel = document.querySelector('.nav-panel');
  const navOverlay = document.querySelector('.nav-overlay');
  const navPanelClose = document.querySelector('.nav-panel-close');
  const sideDrawers = document.querySelector('.side-drawers');
  const contactPanel = document.querySelector('.contact-panel');
  const contactPanelClose = document.querySelector('.contact-panel-close');
  const contactTriggers = document.querySelectorAll('.contact-trigger');
  const locationsPanel = document.querySelector('.locations-panel');
  const contactMobileHeader = document.querySelector('.contact-mobile-header');
  const contactMobileClose = contactMobileHeader?.querySelector('.contact-mobile-close');
  const contactMobileTabList = contactMobileHeader?.querySelector('.contact-mobile-tabs');
  const contactMobileTabs = Array.from(document.querySelectorAll('.contact-mobile-tab'));
  const aboutPanel = document.querySelector('.about-panel');
  const aboutPanelClose = document.querySelector('.about-panel-close');
  const aboutTriggers = document.querySelectorAll('.about-trigger');
  const catalogPanel = document.querySelector('.catalog-panel');
  const catalogPanelClose = document.querySelector('.catalog-panel-close');
  const catalogTriggers = document.querySelectorAll('.catalog-trigger');
  const catalogChooser = document.querySelector('.catalog-chooser');
  const catalogChooserTriggers = document.querySelectorAll('.catalog-chooser-trigger');
  const masterlinkPanel = document.querySelector('.masterlink-panel');
  const masterlinkPanelClose = document.querySelector('.masterlink-panel-close');
  const masterlinkTriggers = document.querySelectorAll('.masterlink-trigger');
  const catalogPdfPanel = document.querySelector('.catalog-pdf-panel');
  const catalogPdfPanelClose = catalogPdfPanel?.querySelector('.masterlink-panel-close');
  const catalogPdfTriggers = document.querySelectorAll('.catalog-pdf-trigger');
  const orderEntryPanel = document.querySelector('.order-entry-panel');
  const orderEntryPanelClose = orderEntryPanel?.querySelector('.order-entry-panel-close');
  const orderEntryTriggers = document.querySelectorAll('.order-entry-trigger');
  const accountFormsPanel = document.querySelector('.account-forms-panel');
  const accountFormsPanelClose = accountFormsPanel?.querySelector('.account-forms-panel-close');
  const accountFormsTriggers = document.querySelectorAll('.account-forms-trigger');
  const careersModal = document.querySelector('.careers-modal');
  const careersModalClose = careersModal?.querySelector('.careers-modal-close');
  const careersTriggers = document.querySelectorAll('.careers-trigger');
  const curtainTransitionMs = 500;
  const mobileCurtainQuery = window.matchMedia('(max-width: 767px)');
  const curtainPanels = [
    contactPanel,
    locationsPanel,
    aboutPanel,
    catalogPanel,
    catalogPdfPanel,
    orderEntryPanel,
    accountFormsPanel
  ].filter(Boolean);

  const contactInfo = document.querySelector('.contact-info');
  let mobileContactView = 'contact';
  let menuReturnFocus = null;
  let scrollLocked = false;
  let savedScrollY = 0;

  const syncCurtainState = () => {
    const isMobile = mobileCurtainQuery.matches;
    const menuIsOpen = navPanel?.classList.contains('is-open') === true;
    const openPanels = curtainPanels.filter((panel) => panel.classList.contains('is-open'));
    const contactPairOpen = contactPanel?.classList.contains('is-open')
      && locationsPanel?.classList.contains('is-open');
    let activeMobilePanel = openPanels[0] || null;

    if (isMobile && contactPairOpen) {
      activeMobilePanel = mobileContactView === 'locations' ? locationsPanel : contactPanel;
    }

    curtainPanels.forEach((panel) => {
      const isOpen = panel.classList.contains('is-open');
      panel.setAttribute('aria-hidden', String(!isOpen || (isMobile && panel !== activeMobilePanel)));
    });

    const showContactTabs = isMobile && Boolean(contactPairOpen);
    if (contactMobileHeader) {
      contactMobileHeader.hidden = !showContactTabs;
      contactMobileHeader.setAttribute('aria-hidden', String(!showContactTabs));
    }
    if (showContactTabs) {
      contactPanel.setAttribute('role', 'tabpanel');
      contactPanel.setAttribute('aria-labelledby', 'contactMobileTab');
      locationsPanel.setAttribute('role', 'tabpanel');
      locationsPanel.setAttribute('aria-labelledby', 'locationsMobileTab');
    } else {
      contactPanel?.removeAttribute('role');
      contactPanel?.removeAttribute('aria-labelledby');
      locationsPanel?.removeAttribute('role');
      locationsPanel?.removeAttribute('aria-labelledby');
    }
    sideDrawers?.classList.toggle(
      'is-contact-locations-active',
      showContactTabs && mobileContactView === 'locations'
    );
    contactMobileTabs.forEach((tab) => {
      const selected = tab.dataset.contactView === mobileContactView;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    navPanel?.setAttribute('aria-hidden', String(!menuIsOpen || (isMobile && Boolean(activeMobilePanel))));
    menuToggle?.setAttribute(
      'aria-expanded',
      String(menuIsOpen && !(isMobile && Boolean(activeMobilePanel)))
    );
    sideDrawers?.classList.toggle('is-contact-mobile', showContactTabs);

    const shouldLockScroll = isMobile && menuIsOpen;
    if (shouldLockScroll && !scrollLocked) {
      savedScrollY = window.scrollY;
      document.body.style.setProperty('--mobile-curtain-scroll-top', `${-savedScrollY}px`);
      document.body.classList.add('mobile-curtain-open');
      scrollLocked = true;
    } else if (!shouldLockScroll && scrollLocked) {
      const restoreScrollY = savedScrollY;
      document.body.classList.remove('mobile-curtain-open');
      document.body.style.removeProperty('--mobile-curtain-scroll-top');
      scrollLocked = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const previousScrollBehavior = document.documentElement.style.scrollBehavior;
          document.documentElement.style.scrollBehavior = 'auto';
          window.scrollTo({ top: restoreScrollY, behavior: 'auto' });
          document.documentElement.style.scrollBehavior = previousScrollBehavior;
        });
      });
    }
  };

  const openNavigation = () => {
    navPanel?.classList.add('is-open');
    navOverlay?.classList.add('is-open');
    syncCurtainState();
  };

  const openContentCurtain = (panel, trigger, additionalPanels = []) => {
    if (trigger && navPanel?.contains(trigger)) menuReturnFocus = trigger;
    openNavigation();
    [panel, ...additionalPanels].forEach((item) => {
      item?.classList.add('is-open');
      item?.setAttribute('aria-hidden', 'false');
    });
    syncCurtainState();

    if (mobileCurtainQuery.matches) {
      const closeButton = panel === contactPanel
        ? contactMobileClose
        : panel?.querySelector('button[aria-label^="Close"]');
      closeButton?.focus({ preventScroll: true });
    }
  };

  const restoreMenuFocus = (delay = curtainTransitionMs) => {
    if (!mobileCurtainQuery.matches) return;
    setTimeout(() => {
      if (!navPanel?.classList.contains('is-open')) return;
      if (curtainPanels.some((panel) => panel.classList.contains('is-open'))) return;
      const target = menuReturnFocus && navPanel.contains(menuReturnFocus)
        ? menuReturnFocus
        : navPanelClose;
      target?.focus({ preventScroll: true });
    }, delay);
  };

  const setMobileContactView = (view, focusTab = false) => {
    mobileContactView = view;
    syncCurtainState();
    if (focusTab) {
      contactMobileTabs.find((tab) => tab.dataset.contactView === view)?.focus({ preventScroll: true });
    }
  };

  const onCurtainBreakpointChange = () => syncCurtainState();
  if (typeof mobileCurtainQuery.addEventListener === 'function') {
    mobileCurtainQuery.addEventListener('change', onCurtainBreakpointChange);
  } else {
    mobileCurtainQuery.addListener(onCurtainBreakpointChange);
  }

  // Collapses locations, then contact, one step at a time - never all at once.
  const closeContact = (onClosed) => {
    locationsPanel?.classList.remove('is-open');
    mobileContactView = 'contact';
    syncCurtainState();
    setTimeout(() => {
      contactPanel?.classList.remove('is-open');
      contactInfo?.classList.remove('is-open');
      syncCurtainState();
      if (onClosed) setTimeout(onClosed, curtainTransitionMs);
      else restoreMenuFocus();
    }, 200);
  };

  const closeAbout = (onClosed) => {
    aboutPanel?.classList.remove('is-open');
    syncCurtainState();
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
    else restoreMenuFocus();
  };

  const setCatalogChooser = (isOpen) => {
    catalogPanel?.classList.toggle('is-chooser', isOpen);
    catalogChooser?.setAttribute('aria-hidden', String(!isOpen));
    catalogPanel?.querySelector('.catalog-panel-inner')?.setAttribute('aria-hidden', String(isOpen));
  };

  const closeCatalog = (onClosed) => {
    setCatalogChooser(false);
    catalogPanel?.classList.remove('is-open');
    syncCurtainState();
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
    else restoreMenuFocus();
  };

  const closeMasterlink = (onClosed) => {
    masterlinkPanel?.classList.remove('is-open');
    masterlinkPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeCatalogPdf = (onClosed) => {
    catalogPdfPanel?.classList.remove('is-open');
    syncCurtainState();
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
    else restoreMenuFocus();
  };

  const closeOrderEntry = (onClosed) => {
    orderEntryPanel?.classList.remove('is-open');
    syncCurtainState();
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
    else restoreMenuFocus();
  };

  const closeAccountForms = (onClosed) => {
    accountFormsPanel?.classList.remove('is-open');
    syncCurtainState();
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
    else restoreMenuFocus();
  };

  if (menuToggle && navPanel && navOverlay) {
    const openMenu = () => {
      openNavigation();
      if (mobileCurtainQuery.matches) navPanelClose?.focus({ preventScroll: true });
    };
    // Staggered close: any inner curtain first, then the menu itself.
    const closeMenu = () => {
      const hadContactOpen = contactPanel?.classList.contains('is-open');
      const hadAboutOpen = aboutPanel?.classList.contains('is-open');
      const hadCatalogOpen = catalogPanel?.classList.contains('is-open');
      const hadMasterlinkOpen = masterlinkPanel?.classList.contains('is-open');
      const hadCatalogPdfOpen = catalogPdfPanel?.classList.contains('is-open');
      const hadOrderEntryOpen = orderEntryPanel?.classList.contains('is-open');
      const hadAccountFormsOpen = accountFormsPanel?.classList.contains('is-open');
      closeContact();
      closeAbout();
      closeCatalog();
      closeMasterlink();
      closeCatalogPdf();
      closeOrderEntry();
      closeAccountForms();
      setTimeout(() => {
        navPanel.classList.remove('is-open');
        navOverlay.classList.remove('is-open');
        syncCurtainState();
        if (mobileCurtainQuery.matches) menuToggle.focus({ preventScroll: true });
      }, (hadContactOpen || hadAboutOpen || hadCatalogOpen || hadMasterlinkOpen || hadCatalogPdfOpen || hadOrderEntryOpen || hadAccountFormsOpen) ? 420 : 0);
    };
    menuToggle.addEventListener('click', openMenu);
    navOverlay.addEventListener('click', closeMenu);
    navPanelClose?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  if (careersModal && careersTriggers.length) {
    let careersTriggerToRestore = null;
    let careersFormLoaded = false;
    const careersFormContainer = careersModal.querySelector('.careers-form-container');
    const loadCareersForm = () => {
      if (careersFormLoaded || !careersFormContainer) return;
      careersFormLoaded = true;
      if (window.location.protocol === 'file:') {
        const fallback = document.createElement('div');
        fallback.className = 'careers-form-fallback';
        const message = document.createElement('p');
        message.textContent = 'The application form cannot be embedded when this page is opened directly from a file. Open it in a new tab instead.';
        const link = document.createElement('a');
        link.href = 'https://form.123formbuilder.com/5066781';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open job application form';
        fallback.append(message, link);
        careersFormContainer.append(fallback);
        return;
      }
      const formFrame = document.createElement('iframe');
      formFrame.src = 'https://form.123formbuilder.com/5066781';
      formFrame.title = 'Job Application Form';
      formFrame.loading = 'lazy';
      careersFormContainer.append(formFrame);
    };
    const closeCareersModal = () => {
      careersModal.classList.remove('is-open');
      careersModal.setAttribute('aria-hidden', 'true');
      careersTriggerToRestore?.focus();
    };
    careersTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        careersTriggerToRestore = trigger;
        loadCareersForm();
        careersModal.classList.add('is-open');
        careersModal.setAttribute('aria-hidden', 'false');
        careersModalClose?.focus();
      });
    });
    careersModalClose?.addEventListener('click', closeCareersModal);
    careersModal.addEventListener('click', (e) => {
      if (e.target === careersModal) closeCareersModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && careersModal.classList.contains('is-open')) closeCareersModal();
    });
  }

  // Contact opens as a second curtain alongside the menu, with locations as a third. Clicking another curtain closes this one first.
  if (contactPanel && contactTriggers.length) {
    const openContact = (e) => {
      e.preventDefault();
      const trigger = e.currentTarget;
      if (contactPanel.classList.contains('is-open')) {
        closeContact();
        return;
      }
      const showContact = () => {
        mobileContactView = 'contact';
        openContentCurtain(contactPanel, trigger, [locationsPanel]);
        contactInfo?.classList.add('is-open');
      };
      if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showContact);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showContact);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showContact);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showContact);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showContact);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showContact);
      } else {
        showContact();
      }
    };
    contactTriggers.forEach((trigger) => trigger.addEventListener('click', openContact));
    contactPanelClose?.addEventListener('click', closeContact);
    contactMobileClose?.addEventListener('click', () => closeContact());
    contactMobileTabList?.addEventListener('click', (e) => {
      const tab = e.target instanceof Element ? e.target.closest('.contact-mobile-tab') : null;
      if (tab instanceof HTMLButtonElement) {
        setMobileContactView(tab.dataset.contactView === 'locations' ? 'locations' : 'contact');
      }
    });
    contactMobileTabList?.addEventListener('keydown', (e) => {
      const currentIndex = contactMobileTabs.indexOf(document.activeElement);
      if (currentIndex < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const nextIndex = e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? contactMobileTabs.length - 1
          : (currentIndex + (e.key === 'ArrowRight' ? 1 : -1) + contactMobileTabs.length) % contactMobileTabs.length;
      const nextTab = contactMobileTabs[nextIndex];
      setMobileContactView(nextTab.dataset.contactView === 'locations' ? 'locations' : 'contact', true);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeContact();
    });
    const contactForm = contactPanel.querySelector('.contact-form');
    const contactFormStatus = contactPanel.querySelector('.contact-form-status');
    const contactPanelInner = contactPanel.querySelector('.contact-panel-inner');
    const contactSubmitButton = contactForm?.querySelector('button[type="submit"]');
    const showContactFormStatus = (message, className) => {
      if (!contactFormStatus) return;
      contactFormStatus.textContent = message;
      contactFormStatus.classList.remove('is-success', 'is-error');
      contactFormStatus.classList.add(className);
      contactFormStatus.hidden = false;
      contactPanelInner?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    contactForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (contactForm.dataset.submitting === 'true') return;
      if (!contactForm.reportValidity()) return;

      contactForm.dataset.submitting = 'true';
      contactForm.setAttribute('aria-busy', 'true');
      if (contactSubmitButton) {
        contactSubmitButton.disabled = true;
        contactSubmitButton.textContent = 'Sending...';
      }
      if (contactFormStatus) {
        contactFormStatus.hidden = true;
        contactFormStatus.textContent = '';
        contactFormStatus.classList.remove('is-success', 'is-error');
      }

      try {
        const response = await fetch('/api/contact/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(contactForm).entries()))
        });
        const result = await response.json();
        if (!response.ok || result.sent !== true) {
          showContactFormStatus(
            result.error || 'Your message could not be sent. Please try again.',
            'is-error'
          );
          return;
        }

        contactForm.reset();
        showContactFormStatus(result.message, 'is-success');
      } catch {
        showContactFormStatus(
          'Your message could not be sent. Please check your connection and try again.',
          'is-error'
        );
      } finally {
        delete contactForm.dataset.submitting;
        contactForm.removeAttribute('aria-busy');
        if (contactSubmitButton) {
          contactSubmitButton.disabled = false;
          contactSubmitButton.textContent = 'Send Message';
        }
      }
    });
  }

  // About Us opens as its own curtain alongside the menu. Clicking another curtain closes this one first.
  if (aboutPanel && aboutTriggers.length) {
    const openAbout = (e) => {
      e.preventDefault();
      const trigger = e.currentTarget;
      if (aboutPanel.classList.contains('is-open')) {
        closeAbout();
        return;
      }
      const showAbout = () => {
        openContentCurtain(aboutPanel, trigger);
      };
      if (contactPanel?.classList.contains('is-open')) {
        closeContact(showAbout);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showAbout);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showAbout);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showAbout);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showAbout);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showAbout);
      } else {
        showAbout();
      }
    };
    aboutTriggers.forEach((trigger) => trigger.addEventListener('click', openAbout));
    aboutPanelClose?.addEventListener('click', closeAbout);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAbout();
    });
  }

  // Login and Register share one catalog preview curtain, then continue to the selected destination.
  if (catalogPanel && catalogTriggers.length) {
    const openCatalog = (e) => {
      e.preventDefault();
      const trigger = e.currentTarget;
      const destination = trigger.dataset.catalogUrl;
      const showCatalog = () => {
        openContentCurtain(catalogPanel, trigger);
        catalogPanel.querySelector('.catalog-login')?.setAttribute('data-destination', destination || '');
        catalogPanel.querySelector('.catalog-register')?.setAttribute('data-destination', destination || '');
      };
      const switchToCatalog = () => {
        if (contactPanel?.classList.contains('is-open')) {
          closeContact(() => {
            if (aboutPanel?.classList.contains('is-open')) closeAbout(showCatalog);
            else showCatalog();
          });
        } else if (aboutPanel?.classList.contains('is-open')) {
          closeAbout(showCatalog);
        } else if (masterlinkPanel?.classList.contains('is-open')) {
          closeMasterlink(showCatalog);
        } else if (catalogPdfPanel?.classList.contains('is-open')) {
          closeCatalogPdf(showCatalog);
        } else if (orderEntryPanel?.classList.contains('is-open')) {
          closeOrderEntry(showCatalog);
        } else if (accountFormsPanel?.classList.contains('is-open')) {
          closeAccountForms(showCatalog);
        } else {
          showCatalog();
        }
      };
      if (catalogPanel.classList.contains('is-open')) {
        setCatalogChooser(false);
        catalogPanel.querySelector('.catalog-login')?.setAttribute('data-destination', destination || '');
        catalogPanel.querySelector('.catalog-register')?.setAttribute('data-destination', destination || '');
      } else {
        switchToCatalog();
      }
    };
    catalogTriggers.forEach((trigger) => trigger.addEventListener('click', openCatalog));
    catalogPanelClose?.addEventListener('click', closeCatalog);

    const catalogRegister = catalogPanel.querySelector('.catalog-register');
    const catalogNotice = catalogPanel.querySelector('.catalog-notice');
    const showCatalogNotice = () => catalogNotice?.classList.add('is-visible');
    const hideCatalogNotice = () => catalogNotice?.classList.remove('is-visible');
    catalogRegister?.addEventListener('mouseenter', showCatalogNotice);
    catalogRegister?.addEventListener('mouseleave', hideCatalogNotice);
    catalogRegister?.addEventListener('focus', showCatalogNotice);
    catalogRegister?.addEventListener('blur', hideCatalogNotice);
  }

  if (catalogPanel && catalogChooser && catalogChooserTriggers.length) {
    const catalogWebChoice = catalogChooser.querySelector('.catalog-choice-web');
    if (catalogWebChoice) {
      catalogChooserTriggers.forEach((trigger) => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          if (catalogPanel.classList.contains('is-open') && catalogPanel.classList.contains('is-chooser')) {
            closeCatalog();
          } else if (catalogPanel.classList.contains('is-open')) {
            setCatalogChooser(true);
          } else {
            setCatalogChooser(true);
            catalogWebChoice.click();
          }
        });
      });
    }
  }

  const setupEmailCodeAccess = (panel, resourceName, onAuthorized) => {
    const emailForm = panel.querySelector('.access-email-form');
    const codeForm = panel.querySelector('.access-code-form');
    const emailInput = emailForm?.querySelector('[name="access-email"]');
    const codeInput = codeForm?.querySelector('[name="access-code"]');
    const status = panel.querySelector('.masterlink-status');
    const backButton = panel.querySelector('.masterlink-back');
    const lead = panel.querySelector('.masterlink-lead');
    let email = '';

    const showStatus = (message, isError = false) => {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-error', isError);
    };

    emailForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      email = emailInput?.value.trim().toLowerCase() || '';
      if (!email.endsWith('@primelinedist.com')) {
        showStatus('Please use your company email address.', true);
        return;
      }

      const button = emailForm.querySelector('button');
      if (button) button.disabled = true;
      showStatus('Sending your access code...');
      try {
        const response = await fetch('/api/access/request-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, resource: resourceName })
        });
        if (!response.ok) throw new Error('request-failed');
        emailForm.hidden = true;
        codeForm.hidden = false;
        backButton.hidden = false;
        if (lead) lead.textContent = `Enter the 3-digit code sent to ${email}.`;
        showStatus('The code expires in 10 minutes.');
        codeInput?.focus();
      } catch {
        showStatus('We could not send the code. Please try again.', true);
      } finally {
        if (button) button.disabled = false;
      }
    });

    codeInput?.addEventListener('input', () => {
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 3);
    });

    const resetAccessForm = (focusEmail = true) => {
      email = '';
      emailForm.hidden = false;
      codeForm.hidden = true;
      backButton.hidden = true;
      codeInput.value = '';
      if (lead) lead.textContent = 'Enter your company email to receive a 3-digit access code.';
      showStatus('');
      if (focusEmail) emailInput?.focus();
    };

    backButton?.addEventListener('click', () => {
      resetAccessForm();
    });

    codeForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = codeInput?.value.trim() || '';
      if (!/^\d{3}$/.test(code)) {
        showStatus('Enter the 3-digit code from your email.', true);
        return;
      }

      const button = codeForm.querySelector('button');
      if (button) button.disabled = true;
      showStatus('Checking your code...');
      try {
        const response = await fetch('/api/access/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, code, resource: resourceName })
        });
        if (!response.ok) {
          showStatus('That code is incorrect or has expired.', true);
          codeInput?.select();
          return;
        }
        codeInput.value = '';
        if (onAuthorized) {
          if (!(await onAuthorized())) {
            showStatus('Your code was accepted, but Catalog access could not be confirmed. Close and reopen the Catalog PDF to retry.', true);
            return;
          }
          return;
        }
        showStatus('Access granted.');
      } catch {
        showStatus('We could not verify the code. Please try again.', true);
      } finally {
        if (button) button.disabled = false;
      }
    });

  };

  if (masterlinkPanel && masterlinkTriggers.length) {
    const openMasterlink = (e) => {
      e.preventDefault();
      const showMasterlink = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        masterlinkPanel.classList.add('is-open');
        masterlinkPanel.setAttribute('aria-hidden', 'false');
      };
      if (masterlinkPanel.classList.contains('is-open')) {
        closeMasterlink();
      } else if (contactPanel?.classList.contains('is-open')) {
        closeContact(() => {
          if (aboutPanel?.classList.contains('is-open')) closeAbout(showMasterlink);
          else showMasterlink();
        });
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showMasterlink);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showMasterlink);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showMasterlink);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showMasterlink);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showMasterlink);
      } else {
        showMasterlink();
      }
    };
    masterlinkTriggers.forEach((trigger) => trigger.addEventListener('click', openMasterlink));
    masterlinkPanelClose?.addEventListener('click', closeMasterlink);

    setupEmailCodeAccess(masterlinkPanel, 'masterlink');
  }

  if (catalogPdfPanel && catalogPdfTriggers.length) {
    let catalogSessionCheckInProgress = false;
    const openCatalogPdf = async (e) => {
      e.preventDefault();
      const trigger = e.currentTarget;
      const showCatalogPdf = () => {
        openContentCurtain(catalogPdfPanel, trigger);
      };
      if (catalogPdfPanel.classList.contains('is-open')) {
        closeCatalogPdf();
        return;
      }

      if (catalogSessionCheckInProgress) return;
      catalogSessionCheckInProgress = true;
      trigger.setAttribute('aria-busy', 'true');
      const sessionStatus = catalogPanel.querySelector('.catalog-session-status');
      if (sessionStatus) {
        sessionStatus.textContent = 'Checking your existing Catalog PDF access...';
        sessionStatus.classList.remove('is-error');
        sessionStatus.hidden = false;
      }

      let hasValidSession = false;
      try {
        const response = await fetch('/api/access/catalog-session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (response.status !== 401) {
          if (!response.ok) throw new Error('catalog-session-check-failed');
          const result = await response.json();
          if (result.authenticated === true && result.resource === 'catalog-pdf') {
            hasValidSession = true;
          } else if (result.authenticated !== false) {
            throw new Error('invalid-catalog-session-response');
          }
        }
      } catch {
        if (sessionStatus) {
          sessionStatus.textContent = 'We could not verify your existing access. Please try again.';
          sessionStatus.classList.add('is-error');
          sessionStatus.hidden = false;
        }
        catalogSessionCheckInProgress = false;
        trigger.removeAttribute('aria-busy');
        return;
      }

      if (sessionStatus) {
        sessionStatus.textContent = '';
        sessionStatus.hidden = true;
      }
      catalogSessionCheckInProgress = false;
      trigger.removeAttribute('aria-busy');
      if (hasValidSession) {
        window.location.assign('/catalog-pdf/');
        return;
      }

      if (contactPanel?.classList.contains('is-open')) {
        closeContact(showCatalogPdf);
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showCatalogPdf);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showCatalogPdf);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showCatalogPdf);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showCatalogPdf);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showCatalogPdf);
      } else {
        showCatalogPdf();
      }
    };
    catalogPdfTriggers.forEach((trigger) => trigger.addEventListener('click', openCatalogPdf));
    catalogPdfPanelClose?.addEventListener('click', closeCatalogPdf);

    setupEmailCodeAccess(catalogPdfPanel, 'catalog-pdf', () => {
      window.location.assign('/catalog-pdf/');
      return true;
    });
  }

  if (orderEntryPanel && orderEntryTriggers.length) {
    const openOrderEntry = (e) => {
      e.preventDefault();
      const trigger = e.currentTarget;
      const showOrderEntry = () => {
        openContentCurtain(orderEntryPanel, trigger);
      };
      if (orderEntryPanel.classList.contains('is-open')) {
        closeOrderEntry();
      } else if (contactPanel?.classList.contains('is-open')) {
        closeContact(showOrderEntry);
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showOrderEntry);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showOrderEntry);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showOrderEntry);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showOrderEntry);
      } else if (accountFormsPanel?.classList.contains('is-open')) {
        closeAccountForms(showOrderEntry);
      } else {
        showOrderEntry();
      }
    };
    orderEntryTriggers.forEach((trigger) => trigger.addEventListener('click', openOrderEntry));
    orderEntryPanelClose?.addEventListener('click', closeOrderEntry);
  }

  if (accountFormsPanel && accountFormsTriggers.length) {
    const openAccountForms = (e) => {
      e.preventDefault();
      const trigger = e.currentTarget;
      const showAccountForms = () => {
        openContentCurtain(accountFormsPanel, trigger);
      };
      if (accountFormsPanel.classList.contains('is-open')) {
        closeAccountForms();
      } else if (contactPanel?.classList.contains('is-open')) {
        closeContact(showAccountForms);
      } else if (aboutPanel?.classList.contains('is-open')) {
        closeAbout(showAccountForms);
      } else if (catalogPanel?.classList.contains('is-open')) {
        closeCatalog(showAccountForms);
      } else if (masterlinkPanel?.classList.contains('is-open')) {
        closeMasterlink(showAccountForms);
      } else if (catalogPdfPanel?.classList.contains('is-open')) {
        closeCatalogPdf(showAccountForms);
      } else if (orderEntryPanel?.classList.contains('is-open')) {
        closeOrderEntry(showAccountForms);
      } else {
        showAccountForms();
      }
    };
    accountFormsTriggers.forEach((trigger) => trigger.addEventListener('click', openAccountForms));
    accountFormsPanelClose?.addEventListener('click', closeAccountForms);
  }

  // Add a copy-to-clipboard button next to every phone/email link in the locations panel.
  if (locationsPanel) {
    locationsPanel.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((link) => {
      const value = link.textContent.trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', `Copy ${value}`);
      btn.innerHTML = '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard?.writeText(value).then(() => {
          btn.classList.add('is-copied');
          setTimeout(() => btn.classList.remove('is-copied'), 1400);
        });
      });
      link.insertAdjacentElement('afterend', btn);
    });
  }

  const slider = document.querySelector('.banner-slider');
  if (slider) {
    const track = slider.querySelector('.slider-track');
    const dotsWrap = slider.querySelector('.slider-dots');
    const prevBtn = slider.querySelector('.slider-arrow--prev');
    const nextBtn = slider.querySelector('.slider-arrow--next');
    // Placeholder copy keyed by image filename (without extension) - replace with final copy per category.
    const bannerCopy = {
      parmigiano: { eyebrow: 'Cheese', title: 'Exceptional Cheese, Selected at the Source', text: 'Parmigiano and international specialties for professional kitchens.' },
      mozzarellaburrata: { eyebrow: 'Fresh Cheese', title: 'Mozzarella & Burrata', text: 'Fresh Italian cheese selected for exceptional texture, flavor and professional service.' },
      antipasto_and_vegetables: { eyebrow: 'Antipasto', title: 'Antipasto & Vegetables', text: 'Reference text about antipasto and vegetables. Replace with final copy.' },
      baking_and_pastry: { eyebrow: 'Baking & Pastry', title: 'Crafted for the Art of Pastry', text: 'Premium ingredients and authentic specialties selected for professional bakers, pastry chefs and culinary creators.' },
      balsamic_vinegars: { eyebrow: 'Balsamic Vinegars', title: 'Exceptional Balsamic Vinegars, Selected at the Source', text: 'Italian Tradition & Distinctive Specialties' },
      beans_and_legumes: { eyebrow: 'Beans & Legumes', title: 'Exceptional Beans & Legumes, Naturally Selected', text: 'Traditional Varieties & Mediterranean Essentials' },
      coffee_and_tea: { eyebrow: 'Coffee & Tea', title: 'Exceptional Coffee & Tea, Selected with Care', text: 'Timeless Rituals & Distinctive Flavors' },
      condiments_sauces_and_stocks: { eyebrow: 'Condiments & Sauces', title: 'The Art of Flavor', text: 'Exceptional Condiments & Culinary Specialties' },
      confections_and_baked_goods: { eyebrow: 'Confections & Baked Goods', title: 'The Sweet Art of Tradition', text: 'Exceptional Confections & Baked Specialties' },
      cured_meats: { eyebrow: 'Cured Meats', title: 'Exceptional Cured Meats, Selected with Care', text: 'Traditional Salumi & International Specialties' },
      desserts_and_gelato: { eyebrow: 'Desserts & Gelato', title: 'The Art of Sweet Indulgence', text: 'Exceptional Desserts & Italian Gelato' },
      fish_and_seafood: { eyebrow: 'Fish & Seafood', title: 'Treasures of the Sea', text: 'Exceptional Fish & Seafood Specialties' },
      flour_rice_and_grains: { eyebrow: 'Flour, Rice & Grains', title: 'The Foundation of Great Cuisine', text: 'Exceptional Flours, Rice & Traditional Grains' },
      'olivesand oil': { eyebrow: 'Olive Oil', title: 'Exceptional Olive Oils, Selected at the Source', text: 'Extra Virgin & Mediterranean Specialties' },
      pasta: { eyebrow: 'Italian Pasta', title: 'The Art of Italian Pasta', text: 'Authentic Tradition & Exceptional Varieties' },
    };

    // Centralized placeholders: replace these paths when the final cheese photography arrives.
    const cheeseImages = {
      hero: 'images/banners/wep-optimized/parmigiano.webp',
      parmigiano: 'images/banners/wep-optimized/parmigiano.webp',
      agedFirm: 'images/banners/wep-optimized/parmigiano.webp',
      alpine: 'images/spots/wep-optimized/gruyere01.webp',
      blue: 'images/spots/wep-optimized/gorgonzola01.webp',
      italy: 'images/spots/wep-optimized/cheesesmisce.webp',
      world: 'images/spots/wep-optimized/romacheese.webp',
    };

    // Full rich landing (intro/trio/spot/tips/diff/close) for categories with final copy - others fall back to a simple caption.
    const categoryDetailTemplates = {
      mozzarellaburrata: () => `
        <div class="mb-page">
          <section class="mb-title reveal"><span class="eyebrow">Fresh Italian Cheese</span><h2>Freshness, Texture and Italian Tradition</h2><span class="mb-title-sub">Mozzarella, Burrata &amp; Fresh Cheese Specialties</span></section>
          <section class="mb-intro">
            <div class="mb-intro-photo reveal"><img src="images/spots/wep-optimized/burrata01.webp" alt="Fresh burrata prepared for service"></div>
            <div class="mb-intro-copy reveal"><span class="eyebrow">Selected for Professional Kitchens</span><h2>Made to Be Enjoyed at Its Freshest</h2><p>Prime Line brings together fresh Italian cheeses selected for their delicate texture, clean flavor and reliable performance in professional kitchens.</p><p>From creamy burrata to classic mozzarella, each selection adds a sense of generosity and authentic Italian character to the plate.</p></div>
          </section>
          <section class="mb-feature mb-feature--mozzarella"><div class="mb-feature-copy reveal"><span class="eyebrow">01 &nbsp; Mozzarella</span><h2>A Fresh Italian Essential</h2><p>Delicate, milky and beautifully balanced, mozzarella brings a clean flavor and supple texture to every dish. Its freshness is what makes it feel both simple and distinctive.</p><p class="mb-detail">Ideal for caprese salads, antipasti, pizzas, pasta and composed plates where quality and freshness take the lead.</p></div><div class="mb-feature-media mb-media--mozzarella reveal"><img src="images/spots/wep-optimized/mozzarella01.webp" alt="Fresh mozzarella prepared for service"></div></section>
          <section class="mb-story">
            <div class="mb-story-gallery reveal"><img class="mb-story-image mb-story-image--primary" src="images/spots/wep-optimized/fioretta01.webp" alt="Artisan fresh cheese production in a Florida facility"><img class="mb-story-image mb-story-image--detail" src="images/spots/wep-optimized/fioretta02.webp" alt="Fresh mozzarella being shaped by hand during production"></div>
            <div class="mb-story-copy reveal"><span class="eyebrow">Crafted with Precision &amp; Care</span><h2>From Production to Professional Kitchens</h2><p>Fresh, artisanal cheeses produced under strict quality standards, with close attention to texture, freshness and consistency from the first step to delivery.</p></div>
          </section>
        </div>`,
      desserts_and_gelato: () => {
        const collections = [
          {
            slot: 'gelato-category-card',
            image: 'wep-optimized/dessert04.webp',
            title: 'Italian Gelato',
            description: 'Distinctive frozen specialties inspired by Italian gelato traditions and celebrated for their flavor and smooth texture.'
          },
          {
            slot: 'desserts-category-card',
            image: 'wep-optimized/dessert05.webp',
            title: 'Classic Desserts',
            description: 'Timeless sweet creations bringing together refined flavors, inviting textures, and memorable presentation.'
          },
          {
            slot: 'frozen-specialties-card',
            image: 'wep-optimized/dessert06.webp',
            title: 'Sorbet & Frozen Specialties',
            description: 'Refreshing frozen expressions and specialty desserts offering variety and creative culinary possibilities.'
          }
        ];
        const verifiedTraditions = [];
        return `
        <div class="dg-page">
          <section class="dg-title reveal">
            <span class="eyebrow">Desserts &amp; Gelato</span>
            <h2>The Art of Sweet Indulgence</h2>
            <span class="dg-title-sub">Exceptional Desserts &amp; Italian Gelato</span>
          </section>
          <section class="dg-intro">
            <div class="dg-intro-photo dg-intro-photo--image reveal"><img src="images/spots/wep-optimized/dessert01.webp" alt="Dessert selection"></div>
            <div class="dg-intro-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>A Celebration of Sweet Moments</h2>
              <p>From timeless Italian favorites to refined dessert creations, sweet specialties have always been part of memorable culinary experiences.</p>
              <p>Prime Line brings together a carefully considered selection of desserts and frozen specialties for restaurants, hotels, cafés, and food professionals who value distinctive flavors and exceptional presentation.</p>
            </div>
          </section>
          <section class="dg-feature dg-feature--gelato">
            <div class="dg-feature-copy reveal">
              <span class="eyebrow">The Italian Gelato Tradition</span>
              <h2>The Italian Art of Gelato</h2>
              <p>Gelato holds a special place in Italian culinary culture, celebrated for its smooth texture, expressive flavors, and distinctive serving tradition.</p>
              <p>From familiar classics to creative specialty flavors, the world of gelato brings enjoyment, variety, and a memorable finishing touch to the dining experience.</p>
              <a href="#dg-collections">Explore Our Gelato Selection</a>
            </div>
            <div class="dg-feature-media dg-feature-media--image reveal"><img src="images/spots/wep-optimized/dessert02.webp" alt="Italian gelato"></div>
          </section>
          <section class="dg-feature dg-feature--desserts">
            <div class="dg-feature-media reveal"><img src="images/spots/wep-optimized/dessert03.webp" alt="Elegant plated dessert"></div>
            <div class="dg-feature-copy reveal">
              <span class="eyebrow">The Pleasure of Dessert</span>
              <h2>The Elegance of a Perfect Dessert</h2>
              <p>A beautifully presented dessert brings together flavor, texture, and creativity, creating a memorable conclusion to the dining experience.</p>
              <p>From traditional inspirations to contemporary presentations, desserts offer countless opportunities to delight guests and complement exceptional menus.</p>
              <a href="#dg-collections">Discover Our Desserts</a>
            </div>
          </section>
          <section class="dg-trio" id="dg-collections" aria-label="Desserts & Gelato editorial categories">
            ${collections.map(({ image, title, description }) => `
            <article class="dg-card reveal">
              <img class="dg-card-media" src="images/spots/${image}" alt="${title}">
              <div class="dg-card-copy"><h3>${title}</h3><p>${description}</p></div>
            </article>`).join('')}
          </section>
          <section class="dg-feature dg-feature--texture">
            <div class="dg-feature-copy reveal">
              <span class="eyebrow">Flavor &amp; Indulgence</span>
              <h2>A World of Flavor &amp; Texture</h2>
              <p>From the velvety richness of frozen specialties to the delicate layers and contrasting textures of classic desserts, the sweet culinary world offers an exceptional variety of experiences.</p>
              <p>Different flavors, temperatures, and presentations allow culinary professionals to create desserts that complement every occasion and inspire memorable moments.</p>
            </div>
            <div class="dg-feature-media dg-feature-media--image reveal"><img src="images/spots/wep-optimized/dessert07.webp" alt="Dessert textures and layers"></div>
          </section>
          <section class="dg-origins">
            <div class="dg-origins-copy reveal">
              <span class="eyebrow">Inspired by Tradition</span>
              <h2>Inspired by Sweet Traditions</h2>
              <p>Across generations, desserts and frozen specialties have reflected the culinary creativity and traditions of different regions.</p>
              <p>These distinctive preparations continue to inspire contemporary hospitality, offering classic expressions alongside new possibilities for flavor and presentation.</p>
            </div>
            <div class="dg-origin-list reveal" aria-label="Verified dessert and frozen specialty categories">
              ${verifiedTraditions.length
                ? verifiedTraditions.map((tradition) => `<span>${tradition}</span>`).join('')
                : '<p class="dg-origin-pending">Dessert and frozen specialty categories pending catalog verification.</p>'}
            </div>
            <p class="dg-origin-note">Timeless traditions. Distinctive flavors. Memorable experiences.</p>
          </section>
          <section class="dg-values">
            <span class="eyebrow">Selected for the Professional Table</span>
            <h2>The Perfect Finish to Every Experience</h2>
            <div class="dg-values-grid">
              <div class="dg-value reveal"><h3>Carefully Selected</h3><p>A considered collection of dessert specialties chosen for their culinary character and presentation appeal.</p></div>
              <div class="dg-value reveal"><h3>Memorable Presentations</h3><p>Sweet specialties offering distinctive flavors, attractive textures, and versatile dessert possibilities.</p></div>
              <div class="dg-value reveal"><h3>Hospitality Essentials</h3><p>Dessert selections suited to restaurants, hotels, cafés, and professional foodservice environments.</p></div>
            </div>
          </section>
          <section class="dg-close">
            <div class="dg-close-media reveal"></div>
            <div class="dg-close-copy reveal">
              <span class="eyebrow dg-eyebrow--light">The Art of Sweet Moments</span>
              <h2>Every Sweet Moment, Made Exceptional</h2>
              <p>Explore our selection of desserts and gelato and discover distinctive sweet specialties for memorable culinary experiences.</p>
            </div>
          </section>
        </div>`;
      },
      fish_and_seafood: () => {
        const collections = [
          {
            slot: 'seafood-anchovies-card',
            image: 'wep-optimized/fish03.webp',
            title: 'Anchovies & Traditional Preserves',
            description: 'Distinctive seafood specialties celebrated for their rich flavor and enduring Mediterranean culinary traditions.'
          },
          {
            slot: 'seafood-tuna-card',
            image: 'wep-optimized/fish04.webp',
            title: 'Tuna & Selected Fish',
            description: 'Versatile fish specialties offering distinctive textures, balanced flavors, and culinary possibilities.'
          },
          {
            slot: 'seafood-specialties-card',
            image: 'wep-optimized/fish05.webp',
            title: 'Seafood Specialties',
            description: 'Traditional and contemporary seafood preparations bringing character and variety to professional menus.'
          }
        ];
        const verifiedFamilies = [];
        return `
        <div class="fs-page">
          <section class="fs-title reveal">
            <span class="eyebrow">Fish &amp; Seafood</span>
            <h2>Treasures of the Sea</h2>
            <span class="fs-title-sub">Exceptional Fish &amp; Seafood Specialties</span>
          </section>
          <section class="fs-intro">
            <div class="fs-intro-photo fs-intro-photo--image reveal"><img src="images/spots/wep-optimized/fish01.webp" alt="Premium seafood selection"></div>
            <div class="fs-intro-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>A Heritage of the Sea</h2>
              <p>For generations, coastal culinary traditions have celebrated the distinctive flavors and remarkable variety of the sea. From carefully prepared fish to traditional seafood specialties, these ingredients hold an important place in Mediterranean cuisine.</p>
              <p>Prime Line presents a thoughtfully considered seafood selection for chefs, restaurants, hospitality, and gourmet food professionals who appreciate authenticity, culinary character, and versatility.</p>
            </div>
          </section>
          <section class="fs-feature fs-feature--tradition">
            <div class="fs-feature-copy reveal">
              <span class="eyebrow">The Art of Preservation</span>
              <h2>Preserving the Taste of the Sea</h2>
              <p>Traditional methods of preparing and preserving seafood have shaped the flavors of coastal cuisines for generations. Salting, marinating, and preserving are among the techniques that contribute to the distinctive character of many Mediterranean seafood specialties.</p>
              <p>These culinary traditions offer an extraordinary variety of tastes and textures, bringing depth and authenticity to the professional kitchen.</p>
              <p class="fs-detail">These are culinary traditions, not claims about the production methods used for every product.</p>
              <a href="#fs-collections">Explore Our Selection</a>
            </div>
            <div class="fs-feature-media fs-feature-media--image reveal"><img src="images/spots/wep-optimized/fish02.webp" alt="Traditional seafood preparation"></div>
          </section>
          <section class="fs-trio" id="fs-collections" aria-label="Fish & Seafood editorial categories">
            ${collections.map(({ image, title, description }) => `
            <article class="fs-card reveal">
              <img class="fs-card-media" src="images/spots/${image}" alt="${title}">
              <div class="fs-card-copy"><h3>${title}</h3><p>${description}</p></div>
            </article>`).join('')}
          </section>
          <section class="fs-feature fs-feature--culinary">
            <div class="fs-feature-copy reveal">
              <span class="eyebrow">From Coast to Kitchen</span>
              <h2>From the Coast to the Kitchen</h2>
              <p>The versatility of fish and seafood specialties creates opportunities across traditional and contemporary menus. From elegant antipasti and Mediterranean pasta dishes to thoughtfully prepared appetizers and salads, these ingredients bring depth and flavor to the table.</p>
              <p>Distinctive seafood selections allow culinary professionals to explore classic preparations while creating memorable dishes for their guests.</p>
              <a href="#fs-collections">Discover Culinary Possibilities</a>
            </div>
            <div class="fs-feature-media fs-feature-media--image reveal"><img src="images/spots/wep-optimized/fish06.webp" alt="Seafood dish prepared for the professional kitchen"></div>
          </section>
          <section class="fs-origins">
            <div class="fs-origins-copy reveal">
              <span class="eyebrow">Rooted in Maritime Heritage</span>
              <h2>A Tradition Shaped by the Sea</h2>
              <p>Across Mediterranean and international coastal communities, seafood traditions have evolved through generations of culinary knowledge, regional ingredients, and distinctive preparations.</p>
              <p>These traditions continue to influence the flavors, textures, and culinary expressions appreciated in professional kitchens today.</p>
            </div>
            <div class="fs-origin-list reveal" aria-label="Verified seafood product families, preparations, and origins">
              ${verifiedFamilies.length
                ? verifiedFamilies.map((family) => `<span>${family}</span>`).join('')
                : '<p class="fs-origin-pending">Product families, preparations, and origins pending catalog verification.</p>'}
            </div>
            <p class="fs-origin-note">Distinctive traditions. Authentic flavors. A world of culinary possibilities.</p>
          </section>
          <section class="fs-values">
            <span class="eyebrow">Selected for the Professional Table</span>
            <h2>Selected for Exceptional Cuisine</h2>
            <div class="fs-values-grid">
              <div class="fs-value reveal"><h3>Carefully Selected</h3><p>A considered assortment focused on culinary character, distinctive flavors, and authentic seafood traditions.</p></div>
              <div class="fs-value reveal"><h3>Distinctive Character</h3><p>Seafood specialties offering a range of textures, preparations, and flavor expressions.</p></div>
              <div class="fs-value reveal"><h3>Culinary Versatility</h3><p>Selections suited to antipasti, appetizers, pasta dishes, and professional culinary creativity.</p></div>
            </div>
          </section>
          <section class="fs-close">
            <div class="fs-close-media reveal"></div>
            <div class="fs-close-copy reveal">
              <span class="eyebrow fs-eyebrow--light">The Mediterranean Experience</span>
              <h2>The Sea, Beautifully Served</h2>
              <p>Explore our selection of fish and seafood specialties and discover distinctive ingredients for inspired culinary creations.</p>
            </div>
          </section>
        </div>`;
      },
      flour_rice_and_grains: () => {
        const verifiedClassifications = [];
        return `
        <div class="frg-page">
          <section class="frg-title reveal">
            <span class="eyebrow">Flour, Rice &amp; Grains</span>
            <h2>The Foundation of Great Cuisine</h2>
            <span class="frg-title-sub">Exceptional Flours, Rice &amp; Traditional Grains</span>
          </section>
          <section class="frg-intro">
            <div class="frg-intro-photo frg-intro-photo--image reveal"><img src="images/spots/wep-optimized/flour01.webp" alt="Flour and artisan baking"></div>
            <div class="frg-intro-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>Extraordinary Cuisine Begins with the Essentials</h2>
              <p>Behind every exceptional recipe are ingredients chosen with care. From the flour that shapes artisanal dough to the rice and grains that define regional culinary traditions, these essentials form the foundation of countless memorable dishes.</p>
              <p>Prime Line presents a thoughtfully considered selection of premium flours, specialty rice, and traditional grains for chefs, restaurants, bakeries, and professional kitchens.</p>
            </div>
          </section>
          <section class="frg-feature frg-feature--flour">
            <div class="frg-feature-copy reveal">
              <span class="eyebrow">The Art of the Dough</span>
              <h2>The Art Begins with Flour</h2>
              <p>Exceptional baking and pasta-making begin with an understanding of flour. Different milling styles and flour characteristics influence the texture, structure, and performance of dough across traditional culinary preparations.</p>
              <p>From pizza and artisanal breads to fresh pasta and specialty creations, selecting the right flour is an essential part of the craft.</p>
              <p class="frg-detail">Specific flour types, protein levels, and milling details will be added only after catalog verification.</p>
            </div>
            <div class="frg-feature-media frg-feature-media--image reveal"><img src="images/spots/wep-optimized/flour02.webp" alt="Artisan flour and dough"></div>
          </section>
          <section class="frg-feature frg-feature--rice">
            <div class="frg-feature-media frg-feature-media--image reveal"><img src="images/spots/wep-optimized/flour03.webp" alt="Rice prepared in an Italian dish"></div>
            <div class="frg-feature-copy reveal">
              <span class="eyebrow">The Italian Rice Tradition</span>
              <h2>The Tradition of Exceptional Rice</h2>
              <p>Rice has an important place in Italian culinary heritage, especially in the preparation of risotto, where the choice of grain contributes to the texture and character of the finished dish.</p>
              <p>Different rice varieties offer distinctive culinary properties, giving chefs the ability to create preparations ranging from classic regional favorites to contemporary interpretations.</p>
              <p class="frg-detail">Specific varieties will be featured only when confirmed in the current assortment.</p>
            </div>
          </section>
          <section class="frg-feature frg-feature--grains">
            <div class="frg-feature-copy reveal">
              <span class="eyebrow">Italian Tradition, Modern Cuisine</span>
              <h2>Pasta, Crafted for Every Possibility</h2>
              <p>Across Italy, pasta has been shaped by regional traditions and generations of culinary craft. Its varied forms, textures, and ingredients make it a defining part of Italian cuisine.</p>
              <p>From classic preparations to contemporary dishes, pasta offers chefs versatile possibilities to bring character and creativity to the table.</p>
              <p class="frg-detail">Specific pasta varieties and production details are pending catalog verification.</p>
            </div>
            <div class="frg-feature-media frg-feature-media--image reveal"><img src="images/spots/wep-optimized/flour05.webp" alt="Pasta prepared with traditional ingredients"></div>
          </section>
          <section class="frg-origins">
            <div class="frg-origins-copy reveal">
              <span class="eyebrow">Rooted in Culinary Heritage</span>
              <h2>Rooted in Tradition, Selected for Excellence</h2>
              <p>Across generations and culinary regions, flours, rice, and grains have shaped the foods that define local traditions.</p>
              <p>Their distinctive properties and applications continue to inspire professional kitchens, connecting authentic ingredients with exceptional culinary results.</p>
            </div>
            <div class="frg-origin-list reveal" aria-label="Verified flour, rice, and grain varieties, traditions, or culinary applications">
              ${verifiedClassifications.length
                ? verifiedClassifications.map((classification) => `<span>${classification}</span>`).join('')
                : '<p class="frg-origin-pending">Varieties, regional traditions, and classifications pending catalog verification.</p>'}
            </div>
            <p class="frg-origin-note">Simple ingredients. Timeless traditions. Exceptional possibilities.</p>
          </section>
          <section class="frg-values">
            <span class="eyebrow">The Professional Foundation</span>
            <h2>Essential Ingredients. Exceptional Results.</h2>
            <div class="frg-values-grid">
              <div class="frg-value reveal"><h3>Carefully Selected</h3><p>A considered assortment of foundational ingredients chosen for their culinary character and versatility.</p></div>
              <div class="frg-value reveal"><h3>Culinary Versatility</h3><p>Selections suited to baking, pizza, pasta, risotto, grain-based dishes, and inspired professional preparations.</p></div>
              <div class="frg-value reveal"><h3>Professional Foundations</h3><p>Essential ingredients for restaurants, bakeries, hospitality, and specialized culinary applications.</p></div>
            </div>
          </section>
          <section class="frg-close">
            <div class="frg-close-media reveal"></div>
            <div class="frg-close-copy reveal">
              <span class="eyebrow frg-eyebrow--light">The Foundation of Exceptional Cuisine</span>
              <h2>Every Great Creation Starts Here</h2>
              <p>Explore our selection of premium flours, specialty rice, and traditional grains, chosen for exceptional culinary possibilities.</p>
            </div>
          </section>
        </div>`;
      },
      pasta: () => {
        const collections = [
          {
            slot: 'italian-pasta-long-card',
            image: 'wep-optimized/pasta06.webp',
            title: 'Long Pasta',
            description: 'Timeless Italian shapes celebrated for their elegance, versatility, and distinctive culinary traditions.'
          },
          {
            slot: 'italian-pasta-short-card',
            image: 'wep-optimized/pasta02.webp',
            title: 'Short & Shaped Pasta',
            description: 'Distinctive forms and textures designed to complement a wide range of sauces and preparations.'
          },
          {
            slot: 'italian-pasta-specialty-card',
            image: 'wep-optimized/pasta05.webp',
            title: 'Specialty Pasta',
            description: 'Unique shapes and culinary expressions that celebrate the remarkable diversity of Italian pasta.'
          }
        ];
        const verifiedTraditions = [];
        return `
        <div class="pa-page">
          <section class="pa-title reveal">
            <span class="eyebrow">Italian Pasta</span>
            <h2>The Art of Italian Pasta</h2>
            <span class="pa-title-sub">Authentic Tradition &amp; Exceptional Varieties</span>
          </section>
          <section class="pa-intro">
            <div class="pa-intro-photo reveal">
              <img src="images/spots/pasta02.jpg" alt="Italian pasta arranged to show its shapes and textures">
            </div>
            <div class="pa-intro-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>A Tradition Shaped by Generations</h2>
              <p>Few foods embody Italian culinary heritage as naturally as pasta. Across generations and regions, its remarkable diversity of shapes, textures, and preparations has made it an essential part of Italy's gastronomic identity.</p>
              <p>Prime Line presents a thoughtfully selected collection of imported Italian pasta for chefs, restaurants, and specialty food professionals who appreciate tradition, distinctive quality, and culinary versatility.</p>
            </div>
          </section>
          <section class="pa-feature pa-feature--craft">
            <div class="pa-feature-copy reveal">
              <span class="eyebrow">The Art of Pasta Making</span>
              <h2>Where Craftsmanship Meets Tradition</h2>
              <p>The character of exceptional pasta begins with carefully considered ingredients, shaping techniques, and production traditions. Different methods influence the pasta's surface, texture, and culinary performance.</p>
              <p>From time-honored preparations to distinctive specialty shapes, Italian pasta reflects a rich heritage of craftsmanship and culinary knowledge.</p>
              <p class="pa-detail">Specific production methods and ingredient claims require verification at the product or brand level.</p>
              <a href="#pa-collections">Explore Our Pasta Selection</a>
            </div>
            <div class="pa-feature-media reveal">
              <img src="images/spots/wep-optimized/pasta01.webp" alt="Italian pasta craftsmanship and traditional pasta making">
            </div>
          </section>
          <section class="pa-trio" id="pa-collections" aria-label="Italian pasta editorial categories">
            ${collections.map(({ image, title, description }) => `
            <article class="pa-card reveal">
              <div class="pa-card-media"><img src="images/spots/${image}" alt="${title}"></div>
              <div class="pa-card-copy"><h3>${title}</h3><p>${description}</p></div>
            </article>`).join('')}
          </section>
          <section class="pa-feature pa-feature--texture">
            <div class="pa-feature-media reveal">
              <img src="images/spots/wep-optimized/pasta09.webp" alt="A variety of Italian pasta shapes and textures">
            </div>
            <div class="pa-feature-copy reveal">
              <span class="eyebrow">Shape &amp; Character</span>
              <h2>Every Shape Has a Story</h2>
              <p>The extraordinary diversity of Italian pasta goes far beyond appearance. From delicate strands to generously shaped tubes and intricate traditional forms, each style brings a distinctive character to the plate.</p>
              <p>Surface texture, size, and shape all contribute to how pasta interacts with sauces, ingredients, and cooking techniques, offering chefs remarkable creative possibilities.</p>
            </div>
          </section>
          <section class="pa-feature pa-feature--culinary">
            <div class="pa-feature-copy reveal">
              <span class="eyebrow">From Tradition to Table</span>
              <h2>Made for the Art of Cooking</h2>
              <p>Pasta brings together exceptional ingredients, culinary technique, and creative expression. From the simplicity of classic Italian preparations to refined restaurant dishes, the right pasta shape contributes to the balance and character of every recipe.</p>
              <p>Prime Line's pasta selection offers professional kitchens versatile possibilities for traditional menus and contemporary culinary inspiration.</p>
              <a href="#pa-collections">Discover Culinary Possibilities</a>
            </div>
            <div class="pa-feature-media reveal">
              <img src="images/spots/pasta06.jpg" alt="Fresh pasta being handled by hand in a traditional kitchen">
            </div>
          </section>
          <section class="pa-origins">
            <div class="pa-origins-copy reveal">
              <span class="eyebrow">Rooted in Italian Heritage</span>
              <h2>A World of Italian Pasta Traditions</h2>
              <p>Across Italy, pasta traditions reflect the ingredients, techniques, and culinary preferences of different regions. Distinctive shapes and preparation styles tell the stories of generations of Italian cooking.</p>
              <p>Together, these traditions create an extraordinary culinary heritage that continues to inspire professional kitchens around the world.</p>
            </div>
            <div class="pa-origin-list reveal" aria-label="Verified pasta product families and traditions">
              ${verifiedTraditions.length
                ? verifiedTraditions.map((tradition) => `<span>${tradition}</span>`).join('')
                : '<p class="pa-origin-pending">Pasta traditions and product families pending catalog verification.</p>'}
            </div>
            <p class="pa-origin-note">Distinctive shapes. Timeless traditions. One exceptional culinary heritage.</p>
          </section>
          <section class="pa-values">
            <span class="eyebrow">Selected for Professional Kitchens</span>
            <h2>Selected for Exceptional Kitchens</h2>
            <div class="pa-values-grid">
              <div class="pa-value reveal"><h3>Carefully Selected</h3><p>A considered assortment of imported Italian pasta chosen for its culinary character, variety, and professional appeal.</p></div>
              <div class="pa-value reveal"><h3>Distinctive Variety</h3><p>Traditional and specialty shapes offering different textures, presentations, and culinary possibilities.</p></div>
              <div class="pa-value reveal"><h3>Culinary Versatility</h3><p>Selections designed to complement classic Italian preparations and contemporary professional menus.</p></div>
            </div>
          </section>
          <section class="pa-close">
            <div class="pa-close-media reveal"></div>
            <div class="pa-close-copy reveal">
              <span class="eyebrow pa-eyebrow--light">The Italian Culinary Tradition</span>
              <h2>A Timeless Italian Tradition, Beautifully Served</h2>
              <p>Explore our selection of authentic Italian pasta and discover exceptional possibilities for inspired culinary creations.</p>
            </div>
          </section>
        </div>`;
      },
      baking_and_pastry: () => `
        <div class="bp-page">
          <section class="bp-title reveal"><span class="eyebrow">Baking &amp; Pastry</span><h2>Crafted for the Art of Pastry</h2><span class="bp-title-sub">Ingredients for Bakers, Pastry Chefs &amp; Culinary Creators</span></section>
          <section class="bp-intro" id="baking-collection">
            <div class="bp-intro-photo reveal"><img src="images/spots/wep-optimized/baking04.webp" alt="Crisp cannoli filled with cream and finished with pistachio"></div>
            <div class="bp-copy reveal"><span class="eyebrow">A Considered Collection</span><h2>Where Craft Meets Ingredient</h2><p>From fine chocolate and aromatic vanilla to delicate pastry shells and traditional Italian specialties, our collection brings together the ingredients professionals trust to create exceptional desserts.</p></div>
          </section>
          <section class="bp-feature bp-feature--essentials">
            <div class="bp-copy reveal"><span class="eyebrow">01 &nbsp; Baking Essentials</span><h2>The Essentials Behind Every Creation</h2><p>Carefully selected ingredients that bring aroma, structure, texture and consistency to every recipe.</p><p class="bp-detail">Vanilla beans, extracts and paste sit alongside almond and coffee extracts, orange blossom water, honey, gelatin, yeast and puff pastry sheets.</p></div>
            <div class="bp-media bp-media--image reveal"><img src="images/spots/wep-optimized/baking01.webp" alt="Baking essentials arranged for professional pastry preparation"></div>
          </section>
          <section class="bp-feature bp-feature--chocolate">
            <div class="bp-media bp-media--image reveal"><img src="images/spots/wep-optimized/baking02.webp" alt="Professional chocolate and pastry ingredients arranged for culinary use"></div>
            <div class="bp-copy bp-copy--light reveal"><span class="eyebrow bp-eyebrow-light">02 &nbsp; Professional Chocolate</span><h2>Chocolate Without Compromise</h2><p>Professional couverture, callets, cocoa and pastry fillings created for precision, performance and remarkable flavor.</p><p class="bp-detail">Callebaut chocolate blocks, callets, chocolate chips, cocoa powder and white chocolate for pastry work that demands control and depth.</p></div>
          </section>
          <section class="bp-feature bp-feature--finishing">
            <div class="bp-copy reveal"><span class="eyebrow">03 &nbsp; Amarena &amp; Finishing</span><h2>The Perfect Finishing Touch</h2><p>Distinctive fruit, glazes and finishing ingredients that transform every dessert into a memorable presentation.</p><p class="bp-detail">Toschi Amarena cherries, cherries in syrup and refined finishing ingredients for pastry chefs who understand the final detail.</p></div>
            <div class="bp-media bp-media--image reveal"><img src="images/spots/wep-optimized/baking03.webp" alt="Amarena cherries and finishing ingredients for pastry presentation"></div>
          </section>
          <section class="bp-cannoli">
            <div class="bp-cannoli-photo reveal"><img src="images/banners/wep-optimized/baking_and_pastry.webp" alt="Crisp Sicilian cannoli filled with ricotta cream and finished with pistachio" style="object-position: 31% 63%;"></div>
            <div class="bp-cannoli-copy reveal"><span class="eyebrow">04 &nbsp; Cannoli</span><h2>A Sicilian Classic, Ready to Create</h2><p>Crisp traditional shells and rich Sicilian ricotta cream bring authentic flavor, texture and character to every cannolo.</p><p class="bp-detail">Large and mini cannoli shells, ricotta cream and professional ingredients for an unmistakably Sicilian finish.</p></div>
          </section>
        </div>`,
      parmigiano: () => `
        <section class="cheese-title reveal">
          <span class="eyebrow">Cheese</span>
          <h2>Exceptional Cheese, Selected at the Source</h2>
          <span class="cheese-title-sub">Parmigiano &amp; International Specialties</span>
        </section>
        <section class="cheese-intro">
          <div class="cheese-intro-photo reveal"><img class="cheese-image" src="${cheeseImages.hero}" alt="Parmigiano Reggiano wheels resting in an aging room" style="object-position: 22% center;"></div>
          <div class="cheese-intro-copy reveal">
            <span class="eyebrow">The Heart of the Collection</span>
            <h2>The Heart of the Collection</h2>
            <p>Since 1981, Prime Line has built its specialty food portfolio around authenticity, craftsmanship and an uncompromising respect for quality.</p>
            <p>At the heart of our cheese collection stands Parmigiano Reggiano, a remarkable expression of origin, patience and time-honored tradition. From balanced younger profiles to deeply matured wheels with complex aromas and crystalline textures, each selection is carefully evaluated for its distinctive character and professional versatility.</p>
            <p>Beyond Parmigiano, our collection brings together celebrated classics and compelling regional specialties from Italy, France, Spain, Switzerland, the Netherlands, England, Denmark, Germany, Norway and the United States, carefully selected for chefs and hospitality professionals who recognize the value of exceptional ingredients.</p>
          </div>
        </section>
        <section class="cheese-feature">
          <div class="cheese-feature-copy reveal">
            <span class="eyebrow">The Heart of the Collection</span>
            <h2>Where Time Becomes Flavor</h2>
            <p>Parmigiano Reggiano reveals its character slowly. As it matures, its texture becomes more crystalline, its aroma more complex and its flavor increasingly profound.</p>
            <p>Our collection spans distinctive ages and profiles, allowing chefs to select the ideal expression for finishing, service, tasting and refined culinary applications.</p>
            <a href="#">Discover Our Parmigiano Selection</a>
          </div>
          <div class="cheese-feature-photo reveal"><img class="cheese-image" src="images/spots/wep-optimized/gennari01.webp" alt="Parmigiano Reggiano wheels and cheese tools in an Italian aging room" style="object-position: 70% center;"></div>
        </section>
        <section class="cheese-trio">
          <article class="cheese-card reveal">
            <img class="cheese-image" src="images/spots/wep-optimized/pecorino01.webp" alt="Pecorino cheese from an Italian producer" style="object-position: 12% center;">
            <div class="cheese-card-copy"><h3>Pecorino</h3><p>A distinguished selection from Italy's finest producers and celebrated regions, offering diverse origins, aging profiles and expressions of authentic sheep's milk cheese.</p></div>
          </article>
          <article class="cheese-card reveal">
            <img class="cheese-image" src="${cheeseImages.alpine}" alt="Cheese resting on timber in a cool aging room" style="object-position: 78% center;">
            <div class="cheese-card-copy"><h3>Alpine &amp; Mountain</h3><p>A distinguished selection of Gruyère and mountain cheeses from renowned European producers, shaped by high pastures, traditional craftsmanship and careful aging.</p></div>
          </article>
          <article class="cheese-card reveal">
            <img class="cheese-image" src="${cheeseImages.blue}" alt="Gorgonzola cheese from an Italian producer" style="object-position: 48% center;">
            <div class="cheese-card-copy"><h3>Gorgonzola</h3><p>A distinguished selection from renowned Italian producers, offering styles from creamy and delicately veined to bold, complex and intensely expressive.</p></div>
          </article>
        </section>
        <section class="cheese-feature cheese-feature--italy">
          <div class="cheese-feature-photo reveal"><img class="cheese-image" src="${cheeseImages.italy}" alt="An assortment of Italian cheeses from celebrated regions and producers" style="object-position: 34% center;"></div>
          <div class="cheese-feature-copy reveal">
            <span class="eyebrow">Italy, Region by Region</span>
            <h2>Traditions with a Sense of Place</h2>
            <p>Beyond Parmigiano, our Italian collection brings together distinctive cheeses from celebrated regions and respected producers.</p>
            <p>From aged Pecorino and Grana varieties to Taleggio, Gorgonzola, Asiago, Fontina and Provolone, each selection reflects the milk, landscape and traditions of its origin.</p>
          </div>
        </section>
        <section class="cheese-origins">
          <div class="cheese-origins-copy reveal">
            <span class="eyebrow">Selected Across Continents</span>
            <h2>A World of Cheese, Thoughtfully Curated</h2>
            <p>Prime Line sources from celebrated cheesemaking regions across Italy, France, Spain, Switzerland, the Netherlands, England, Denmark, Germany, Norway and the United States, bringing together established classics and distinctive discoveries for today&apos;s professional kitchens.</p>
          </div>
          <div class="cheese-origin-list reveal">
            <span>Italy</span><span>France</span><span>Spain</span><span>Switzerland</span><span>The Netherlands</span>
            <span>England</span><span>Denmark</span><span>Germany</span><span>Norway</span><span>United States</span>
          </div>
          <p class="cheese-origin-note">Many origins. Distinct traditions. One carefully considered collection.</p>
        </section>
        <section class="cheese-values">
          <span class="eyebrow">A Collection Built for Food Professionals</span>
          <div class="cheese-values-grid">
            <div class="cheese-value reveal"><h3>Carefully Selected</h3><p>Distinctive cheeses chosen for origin, maturation, texture and exceptional culinary character.</p></div>
            <div class="cheese-value reveal"><h3>Professional Formats</h3><p>Practical formats and profiles selected for consistency, service and demanding kitchen applications.</p></div>
            <div class="cheese-value reveal"><h3>Global Assortment</h3><p>Celebrated classics and compelling discoveries sourced from respected cheesemaking regions worldwide.</p></div>
          </div>
        </section>
        <section class="cheese-close">
          <img class="cheese-image" src="${cheeseImages.world}" alt="A curated selection of cheeses from renowned regions around the world" style="object-position: 46% center;">
          <div class="cheese-close-copy reveal">
            <span class="eyebrow cv-eyebrow--light">Exceptional Origins</span>
            <h2>From the Great Cheese Regions of the World</h2>
            <p>A distinguished collection shaped by place, tradition and time, selected for chefs and hospitality professionals who understand the value of exceptional ingredients.</p>
          </div>
        </section>`,
      cured_meats: () => {
        const verifiedStyles = ['Parma DOP', 'San Daniele DOP', 'Mortadella IGP', 'Prosciutto Cotto', 'Coppa'];
        return `
        <div class="cm-page">
          <section class="cm-title reveal">
            <span class="eyebrow">Cured Meats</span>
            <h2>Exceptional Cured Meats, Selected with Care</h2>
            <span class="cm-title-sub">Traditional Salumi &amp; International Specialties</span>
          </section>
          <section class="cm-intro">
            <div class="cm-intro-photo reveal"><img src="images/banners/wep-optimized/cured_meats.webp" alt="Traditional cured meats and salumi"></div>
            <div class="cm-intro-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>A Tradition Worth Preserving</h2>
              <p>Across generations and regions, the art of curing meats has brought together patience, craftsmanship, and distinctive culinary traditions.</p>
              <p>Prime Line presents a carefully considered selection of cured meats and traditional specialties, offering exceptional flavors and versatile choices for professional kitchens and hospitality.</p>
            </div>
          </section>
          <section class="cm-feature cm-feature--craft">
            <div class="cm-feature-copy reveal">
              <span class="eyebrow">The Art of Curing</span>
              <h2>Where Patience Becomes Flavor</h2>
              <p>Time, technique, and tradition shape the character of exceptional cured meats. From delicate textures to deeply developed aromas, each style offers a distinctive expression of its heritage.</p>
              <p>These qualities make traditional salumi a valued part of antipasti, specialty sandwiches, charcuterie presentations, and contemporary menus.</p>
              <a href="#cm-collections">Explore Our Selection</a>
            </div>
            <div class="cm-feature-media reveal"><img src="images/spots/wep-optimized/meats06.webp" alt="Cured meats prepared with traditional craftsmanship"></div>
          </section>
          <section class="cm-trio" id="cm-collections">
            <article class="cm-card reveal">
              <div class="cm-card-media"><img src="images/spots/wep-optimized/meats03.webp" alt="Guanciale"></div>
              <div class="cm-card-copy"><h3>Guanciale</h3><p>Traditional cured pork cheek with rich flavor and delicate texture.</p></div>
            </article>
            <article class="cm-card reveal">
              <div class="cm-card-media"><img src="images/spots/wep-optimized/meats04.webp" alt="Salami and traditional salumi"></div>
              <div class="cm-card-copy"><h3>Salami &amp; Traditional Salumi</h3><p>Regional character, balanced seasoning, and distinctive artisanal styles.</p></div>
            </article>
            <article class="cm-card reveal">
              <div class="cm-card-media"><img src="images/spots/wep-optimized/meats05.webp" alt="Mortadella and specialties"></div>
              <div class="cm-card-copy"><h3>Mortadella &amp; Specialties</h3><p>Classic deli traditions with exceptional culinary versatility.</p></div>
            </article>
          </section>
          <section class="cm-feature cm-feature--specialty">
            <div class="cm-feature-copy reveal">
              <span class="eyebrow">Beyond the Classics</span>
              <h2>Distinctive Traditions, Exceptional Character</h2>
              <p>Beyond familiar favorites, cured meat traditions offer a remarkable range of textures, aromas, and regional expressions.</p>
              <p>From delicately seasoned specialties to richer, more intensely flavored cuts, our approach celebrates variety, authenticity, and thoughtful selection.</p>
            </div>
            <div class="cm-feature-media reveal"><img src="images/spots/wep-optimized/meats02.webp" alt="Specialty cured meats"></div>
          </section>
          <section class="cm-origins">
            <div class="cm-origins-copy reveal">
              <span class="eyebrow">Selected with Purpose</span>
              <h2>A Collection Shaped by Tradition</h2>
              <p>Different regions and curing traditions bring their own distinctive character to the table. Our collection reflects this diversity through a selection of classic cured meats and specialty salumi.</p>
            </div>
            <div class="cm-origin-list reveal" aria-label="Verified cured meat origins and styles">
              ${verifiedStyles.map((style) => `<span>${style}</span>`).join('')}
            </div>
          </section>
          <section class="cm-close">
            <div class="cm-close-media" role="img" aria-label="Cured meats and salumi"><img src="images/banners/wep-optimized/cured_meats02.webp" alt=""></div>
            <div class="cm-close-copy reveal">
              <span class="eyebrow cm-eyebrow--light">Cured Meats</span>
              <h2>Many traditions.<br>Distinctive flavors.</h2>
              <p>One carefully considered collection.</p>
            </div>
          </section>
        </div>`;
      },
      balsamic_vinegars: () => {
        const collections = [
          {
            slot: 'balsamic-classic',
            image: 'wep-optimized/vinegars04.webp',
            imageClass: 'classic',
            title: 'Balsamic Vinegars',
            description: 'Classic expressions appreciated for their versatility, balanced acidity, and distinctive flavor.'
          },
          {
            slot: 'balsamic-aged',
            image: 'wep-optimized/vinegars05.webp',
            imageClass: 'aged',
            title: 'Aged & Specialty Balsamics',
            description: 'Selected expressions offering distinctive richness, aroma, and culinary character.'
          },
          {
            slot: 'balsamic-condiments',
            image: 'wep-optimized/vinegars06.webp',
            imageClass: 'condiments',
            title: 'Balsamic Condiments & Glazes',
            description: 'Versatile finishing specialties that bring contrast, flavor, and visual appeal to creative dishes.'
          }
        ];
        const verifiedCategories = [];
        return `
        <div class="vc-page">
          <section class="vc-title reveal">
            <span class="eyebrow">Balsamic Vinegars</span>
            <h2>Exceptional Balsamic Vinegars, Selected at the Source</h2>
            <span class="vc-title-sub">Italian Tradition &amp; Distinctive Specialties</span>
          </section>
          <section class="vc-intro">
            <div class="vc-media-image reveal"><img src="images/spots/wep-optimized/vinegars03.webp" alt="Italian balsamic vinegar and specialty condiments"></div>
            <div class="vc-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>A Heritage of Exceptional Flavor</h2>
              <p>Rooted in Italian culinary tradition, balsamic vinegar brings a remarkable balance of aroma, acidity, sweetness, and complexity to the table.</p>
              <p>Prime Line presents a carefully considered selection of balsamic vinegars and specialty condiments for chefs, restaurants, and gourmet food professionals.</p>
            </div>
          </section>
          <section class="vc-feature">
            <div class="vc-copy reveal">
              <span class="eyebrow">The Art of Balsamic</span>
              <h2>Where Time Creates Character</h2>
              <p>From the careful selection of ingredients to the traditions of maturation and blending, balsamic craftsmanship reflects a deep respect for flavor and balance.</p>
              <p>Different styles offer distinctive textures, aromas, and levels of intensity, allowing chefs to select the right expression for each culinary application.</p>
              <a href="#vc-collections">Discover Our Selection</a>
            </div>
            <div class="vc-media-image reveal"><img src="images/spots/wep-optimized/vinegars01.webp" alt="Balsamic vinegar craftsmanship"></div>
          </section>
          <section class="vc-trio" id="vc-collections" aria-label="Balsamic collections">
            ${collections.map(({ slot, image, imageClass, title, description }) => `
            <article class="vc-card reveal">
              <div class="vc-card-media vc-card-media--${imageClass}">
                <img src="images/spots/${image}" alt="${title}">
              </div>
              <div class="vc-card-copy"><h3>${title}</h3><p>${description}</p></div>
            </article>`).join('')}
          </section>
          <section class="vc-feature vc-feature--texture">
            <div class="vc-media-image reveal"><img src="images/spots/wep-optimized/vinegars07.webp" alt="Balsamic vinegar showing its natural color and texture"></div>
            <div class="vc-copy reveal">
              <span class="eyebrow">Balance &amp; Complexity</span>
              <h2>The Perfect Balance of Sweetness &amp; Acidity</h2>
              <p>Each balsamic expression offers its own relationship between acidity, sweetness, aroma, and texture.</p>
              <p>From everyday culinary preparations to carefully finished dishes, selecting the right profile can bring depth and harmony to a wide range of ingredients.</p>
            </div>
          </section>
          <section class="vc-origins">
            <div class="vc-origins-copy reveal">
              <span class="eyebrow">Rooted in Tradition</span>
              <h2>Rooted in Italian Tradition</h2>
              <p>The traditions associated with Modena and the surrounding region have shaped some of the world's most recognized balsamic specialties.</p>
              <p>Understanding their different styles and designations allows culinary professionals to appreciate the distinctive qualities of each selection.</p>
            </div>
            <div class="vc-origin-list reveal${verifiedCategories.length ? '' : ' is-pending'}" aria-label="Balsamic catalog classifications">
              ${verifiedCategories.length
                ? verifiedCategories.map((category) => `<span>${category}</span>`).join('')
                : '<p class="vc-origin-pending">Catalog classifications pending verification.</p>'}
            </div>
            <p class="vc-origin-note">Distinctive expressions. Timeless traditions. Carefully selected.</p>
          </section>
          <section class="vc-values">
            <span class="eyebrow">A Collection Built for Food Professionals</span>
            <div class="vc-values-grid">
              <div class="vc-value reveal"><h3>Culinary Versatility</h3><p>Distinctive flavors for dressings, marinades, sauces, reductions, and finishing.</p></div>
              <div class="vc-value reveal"><h3>Selected Profiles</h3><p>A range of culinary expressions designed for different flavor preferences and applications.</p></div>
              <div class="vc-value reveal"><h3>Professional Selection</h3><p>Specialty condiments chosen with the needs of restaurants, hospitality, and gourmet retail in mind.</p></div>
            </div>
          </section>
          <section class="vc-close">
            <div class="vc-close-media reveal" role="img" aria-label="Balsamic vinegar setting with dark glass and warm natural highlights">
              <img src="images/spots/wep-optimized/vinegars02.webp" alt="">
            </div>
            <div class="vc-close-copy reveal">
              <span class="eyebrow vc-eyebrow--light">An Italian Legacy</span>
              <h2>A Tradition Worth Savoring</h2>
              <p>Explore the distinctive world of balsamic vinegars and specialty condiments selected by Prime Line.</p>
            </div>
          </section>
        </div>`;
      },
      beans_and_legumes: () => {
        const verifiedVarieties = [];
        return `
        <div class="bl-page">
          <section class="bl-title reveal">
            <span class="eyebrow">Beans &amp; Legumes</span>
            <h2>Exceptional Beans &amp; Legumes, Naturally Selected</h2>
            <span class="bl-title-sub">Traditional Varieties &amp; Mediterranean Essentials</span>
          </section>
          <section class="bl-intro">
            <div class="bl-intro-photo reveal"><img src="images/spots/wep-optimized/beans01.webp" alt="Beans and legumes selected for the collection"></div>
            <div class="bl-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>The Beauty of Simple Ingredients</h2>
              <p>Some of the world's most celebrated dishes begin with the simplest ingredients. Beans and legumes have long been essential to Mediterranean cooking, valued for their distinctive textures, satisfying flavors, and remarkable culinary versatility.</p>
              <p>Prime Line brings together a considered selection of beans and legumes for chefs, restaurants, and specialty food professionals who appreciate the character and possibilities of exceptional ingredients.</p>
            </div>
          </section>
          <section class="bl-origins">
            <div class="bl-origins-copy reveal">
              <span class="eyebrow">A Culinary Heritage</span>
              <h2>A Tradition Across Generations</h2>
              <p>Throughout Mediterranean and international cooking traditions, beans and legumes have remained fundamental ingredients, reflecting the tastes, techniques, and culinary identities of different regions.</p>
              <p>Prime Line's collection celebrates this enduring versatility with a selection designed for today's professional kitchens.</p>
            </div>
            <div class="bl-variety-list reveal${verifiedVarieties.length ? '' : ' is-pending'}" aria-label="Verified catalog varieties and styles">
              ${verifiedVarieties.length
                ? verifiedVarieties.map((variety) => `<span>${variety}</span>`).join('')
                : '<p class="bl-variety-pending">Catalog varieties and styles pending verification.</p>'}
            </div>
            <p class="bl-origin-note">Simple origins. Distinctive traditions. Endless culinary inspiration.</p>
          </section>
          <section class="bl-values">
            <span class="eyebrow">A Collection Built for Food Professionals</span>
            <div class="bl-values-grid">
              <div class="bl-value reveal"><h3>Carefully Selected</h3><p>A considered assortment focused on ingredient character, versatility, and culinary appeal.</p></div>
              <div class="bl-value reveal"><h3>Culinary Versatility</h3><p>Ingredients suited to traditional recipes, contemporary presentations, and professional menus.</p></div>
              <div class="bl-value reveal"><h3>Professional Essentials</h3><p>Reliable culinary staples for restaurants, hospitality, and specialty foodservice applications.</p></div>
            </div>
          </section>
          <section class="bl-close">
            <div class="bl-close-media reveal" role="img" aria-label="A warm Mediterranean table with legume-based dishes">
              <img src="images/spots/wep-optimized/beans02.webp" alt="">
            </div>
            <div class="bl-close-copy reveal">
              <span class="eyebrow bl-eyebrow--light">From the Earth to the Table</span>
              <h2>Simple Ingredients. Remarkable Possibilities.</h2>
              <p>Explore our selection of beans and legumes and discover essential ingredients for inspired professional cooking.</p>
            </div>
          </section>
        </div>`;
      },
      'olivesand oil': () => {
        const collections = [
          {
            slot: 'olive-oil-extra-virgin-card',
            image: 'wep-optimized/oil03.webp',
            title: 'Extra Virgin Olive Oils',
            description: 'Distinctive olive oils selected for their character, expressive flavors, and culinary versatility.'
          },
          {
            slot: 'olive-oil-regional-card',
            image: 'wep-optimized/oil04.webp',
            title: 'Regional & Specialty Oils',
            description: 'A celebration of different traditions, origins, and carefully selected olive oil expressions.'
          },
          {
            slot: 'olive-oil-professional-card',
            image: 'wep-optimized/oil05.webp',
            title: 'Culinary & Professional Formats',
            description: 'Versatile selections and practical formats designed for the demands of professional kitchens.'
          }
        ];
        const verifiedOrigins = [];
        return `
        <div class="oo-page">
          <section class="oo-title reveal">
            <span class="eyebrow">Olive Oil</span>
            <h2>Exceptional Olive Oils, Selected at the Source</h2>
            <span class="oo-title-sub">Extra Virgin &amp; Mediterranean Specialties</span>
          </section>
          <section class="oo-intro">
            <div class="oo-media-pending oo-media-image reveal"><img src="images/spots/wep-optimized/oil01.webp" alt="Olive oil with fresh olives"></div>
            <div class="oo-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>The Heart of Mediterranean Cuisine</h2>
              <p>Few ingredients express the essence of Mediterranean cooking as naturally as olive oil. From its distinctive aromas to its remarkable culinary versatility, olive oil has been central to regional food traditions for generations.</p>
              <p>Prime Line brings together a carefully considered selection of olive oils for chefs, restaurants, and specialty food professionals who appreciate authenticity, character, and exceptional ingredients.</p>
            </div>
          </section>
          <section class="oo-feature oo-feature--harvest">
            <div class="oo-copy reveal">
              <span class="eyebrow">From Grove to Table</span>
              <h2>From Harvest to Exceptional Flavor</h2>
              <p>The character of olive oil begins with the fruit itself. Olive varieties, growing conditions, harvest timing, and production techniques contribute to the distinctive aromas and flavors found in different oils.</p>
              <p>From delicate and balanced to vibrant and intensely expressive, each selection offers its own culinary possibilities.</p>
              <a href="#oo-collections">Explore Our Olive Oil Selection</a>
            </div>
            <div class="oo-media-pending oo-media-image reveal"><img src="images/spots/wep-optimized/oil02.webp" alt="Olive harvest in a Mediterranean grove"></div>
          </section>
          <section class="oo-trio" id="oo-collections" aria-label="Olive oil editorial categories">
            ${collections.map(({ image, title, description }) => `
            <article class="oo-card reveal">
              <img class="oo-card-media" src="images/spots/${image}" alt="${title}">
              <div class="oo-card-copy"><h3>${title}</h3><p>${description}</p></div>
            </article>`).join('')}
          </section>
          <section class="oo-feature oo-feature--flavor">
            <div class="oo-copy reveal">
              <span class="eyebrow">Olives &amp; Olive Oil</span>
              <h2>A Mediterranean Tradition, from Olive to Oil</h2>
              <p>Olives and olive oil are central to Mediterranean cuisine, valued for their distinctive character, regional traditions, and versatility at the table.</p>
              <p>From olives served as antipasti to olive oil used for seasoning, finishing, and cooking, both bring depth and character to a wide range of dishes.</p>
            </div>
            <div class="oo-media-pending oo-media-image reveal"><img src="images/spots/oil04.jpg" alt="Mediterranean olives and olive oil"></div>
          </section>
          <section class="oo-origins">
            <div class="oo-origins-copy reveal">
              <span class="eyebrow">Rooted in the Land</span>
              <h2>A Heritage Rooted in the Land</h2>
              <p>Across the Mediterranean, olive-growing traditions reflect the landscapes, climates, and culinary cultures of their regions.</p>
              <p>Each origin brings distinctive influences to the character of olive oil, contributing to a rich diversity of styles and gastronomic traditions.</p>
            </div>
            <div class="oo-origin-list reveal${verifiedOrigins.length ? '' : ' is-pending'}" aria-label="Verified olive oil origins and styles">
              ${verifiedOrigins.length
                ? verifiedOrigins.map((origin) => `<span>${origin}</span>`).join('')
                : '<p class="oo-origin-pending">Catalog origins and styles pending verification.</p>'}
            </div>
            <p class="oo-origin-note">Distinctive origins. Authentic traditions. One carefully considered collection.</p>
          </section>
          <section class="oo-values">
            <span class="eyebrow">A Collection Built for Food Professionals</span>
            <div class="oo-values-grid">
              <div class="oo-value reveal"><h3>Carefully Selected</h3><p>A considered selection focused on authenticity, distinctive character, and culinary quality.</p></div>
              <div class="oo-value reveal"><h3>Distinctive Profiles</h3><p>Different expressions of flavor and intensity suited to a wide range of culinary preparations.</p></div>
              <div class="oo-value reveal"><h3>Professional Versatility</h3><p>Olive oil selections suited to finishing, seasoning, cooking, and the creative needs of professional kitchens.</p></div>
            </div>
          </section>
          <section class="oo-close">
            <div class="oo-media-pending oo-media-image reveal"><img src="images/spots/wep-optimized/oil06.webp" alt="Mediterranean table with olive oil, bread, and olives"></div>
            <div class="oo-close-copy reveal">
              <span class="eyebrow oo-eyebrow--light">The Mediterranean Tradition</span>
              <h2>The Essence of the Mediterranean Table</h2>
              <p>Explore our carefully selected olive oils and discover distinctive flavors for inspired culinary creations.</p>
            </div>
          </section>
        </div>`;
      },
      coffee_and_tea: () => {
        const verifiedClassifications = [];
        return `
        <div class="coffee-page">
          <section class="coffee-title reveal">
            <span class="eyebrow">Coffee &amp; Tea</span>
            <h2>Exceptional Coffee &amp; Tea, Selected with Care</h2>
            <span class="coffee-title-sub">Timeless Rituals &amp; Distinctive Flavors</span>
          </section>
          <section class="coffee-intro">
            <div class="coffee-photo reveal"><img src="images/spots/wep-optimized/coffee01.webp" alt="Coffee and tea arranged for a warm hospitality setting"></div>
            <div class="coffee-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>The Art of Everyday Rituals</h2>
              <p>Across cultures and generations, coffee and tea have inspired traditions built around aroma, preparation, and the simple pleasure of an exceptional cup.</p>
              <p>From the unmistakable character of Italian espresso to the delicate expressions of fine tea, Prime Line celebrates these timeless beverages as an essential part of the culinary and hospitality experience.</p>
            </div>
          </section>
          <section class="coffee-feature">
            <div class="coffee-copy reveal">
              <span class="eyebrow">The Italian Coffee Tradition</span>
              <h2>The Soul of Italian Espresso</h2>
              <p>Few beverages capture the spirit of Italian daily life like espresso. Its concentrated character, rich aroma, and distinctive preparation have made it an enduring symbol of Italian coffee culture.</p>
              <p>Our coffee presentation celebrates this tradition and the important role of a memorable espresso experience in cafés, restaurants, and hospitality.</p>
            </div>
            <div class="coffee-photo reveal"><img src="images/spots/wep-optimized/coffee02.webp" alt="Italian espresso prepared for a professional café"></div>
          </section>
          <section class="coffee-feature coffee-feature--tea">
            <div class="coffee-photo reveal"><img src="images/spots/wep-optimized/coffee03.webp" alt="Tea service arranged for hospitality"></div>
            <div class="coffee-copy reveal">
              <span class="eyebrow">The Art of Tea</span>
              <h2>A Tradition of Balance &amp; Discovery</h2>
              <p>Tea offers a world of distinctive aromas, delicate nuances, and preparation rituals. From familiar classics to expressive specialty infusions, each style presents its own character and experience.</p>
              <p>Elegant in its simplicity and versatile in service, tea remains an important part of hospitality and the enjoyment of everyday moments.</p>
            </div>
          </section>
          <section class="coffee-origins">
            <div class="coffee-origins-copy reveal">
              <span class="eyebrow">Traditions Across Cultures</span>
              <h2>Distinctive Traditions, Thoughtfully Selected</h2>
              <p>Coffee and tea traditions reflect the cultures, preparation methods, and preferences of communities around the world.</p>
              <p>Our approach celebrates this diversity through distinctive selections designed to complement different tastes, occasions, and professional hospitality environments.</p>
            </div>
            <div class="coffee-origin-list reveal${verifiedClassifications.length ? '' : ' is-pending'}" aria-label="Verified coffee and tea categories and styles">
              ${verifiedClassifications.length
                ? verifiedClassifications.map((classification) => `<span>${classification}</span>`).join('')
                : '<p class="coffee-origin-pending">Catalog categories and styles pending verification.</p>'}
            </div>
            <p class="coffee-origin-note">Different traditions. Distinctive aromas. One carefully considered collection.</p>
          </section>
          <section class="coffee-values">
            <span class="eyebrow">A Collection Built for Food Professionals</span>
            <div class="coffee-values-grid">
              <div class="coffee-value reveal"><h3>Carefully Selected</h3><p>Distinctive beverage specialties chosen for their character, culinary appeal, and service potential.</p></div>
              <div class="coffee-value reveal"><h3>Distinctive Experiences</h3><p>Coffee and tea selections that complement different tastes, occasions, and hospitality settings.</p></div>
              <div class="coffee-value reveal"><h3>Hospitality Essentials</h3><p>Beverage specialties suited to cafés, restaurants, hotels, and gourmet foodservice environments.</p></div>
            </div>
          </section>
          <section class="coffee-close">
            <div class="coffee-close-copy reveal">
              <span class="eyebrow coffee-eyebrow--light">The Art of Every Cup</span>
              <h2>Every Cup, an Exceptional Experience</h2>
              <p>Explore the coffee and tea selection from Prime Line and discover distinctive beverages for inspired hospitality.</p>
            </div>
          </section>
        </div>`;
      },
      condiments_sauces_and_stocks: () => {
        const collections = [
          {
            title: 'Tomato-Based Sauces',
            image: 'wep-optimized/condiments03.webp',
            description: 'Classic culinary favorites bringing richness, balance, and the vibrant character of tomatoes to the table.'
          },
          {
            title: 'Pesto & Herb Sauces',
            image: 'wep-optimized/condiments04.webp',
            description: 'Distinctive herb-forward preparations inspired by culinary tradition and fresh, expressive flavors.'
          },
          {
            title: 'Specialty Condiments & Spreads',
            image: 'wep-optimized/condiments05.webp',
            description: 'Versatile culinary specialties designed to bring depth, contrast, and character to exceptional dishes.'
          }
        ];
        const verifiedStyles = [];
        return `
        <div class="cs-page">
          <section class="cs-title reveal">
            <span class="eyebrow">Condiments &amp; Sauces</span>
            <h2>The Art of Flavor</h2>
            <span class="cs-title-sub">Exceptional Condiments &amp; Culinary Specialties</span>
          </section>
          <section class="cs-intro">
            <div class="cs-editorial-photo reveal"><img src="images/spots/wep-optimized/condiments01.webp" alt="Condiments and sauce ingredients prepared for the collection"></div>
            <div class="cs-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>The Ingredients Behind Exceptional Flavor</h2>
              <p>Behind every memorable dish is a careful balance of ingredients, flavors, and culinary traditions. Sauces and condiments bring character, depth, and individuality to the table, transforming familiar preparations into distinctive experiences.</p>
              <p>Prime Line presents a thoughtfully considered selection of sauces, condiments, and specialty ingredients for chefs, restaurants, and gourmet food professionals.</p>
            </div>
          </section>
          <section class="cs-feature">
            <div class="cs-copy reveal">
              <span class="eyebrow">Crafted with Character</span>
              <h2>Crafted to Bring Out the Best</h2>
              <p>From traditional recipes to distinctive regional preparations, the world of sauces and condiments reflects a remarkable variety of ingredients, techniques, and culinary influences.</p>
              <p>Each style brings its own expression of flavor, offering chefs new ways to complement, enhance, and elevate their creations.</p>
              <a href="#cs-collections">Explore Our Selection</a>
            </div>
            <div class="cs-editorial-photo reveal"><img src="images/spots/wep-optimized/condiments02.webp" alt="Sauce preparation highlighting culinary craftsmanship"></div>
          </section>
          <section class="cs-trio" id="cs-collections" aria-label="Sauces and condiments editorial categories">
            ${collections.map(({ title, image, description }) => `
            <article class="cs-card reveal">
              <div class="cs-card-media">
                <img src="images/spots/${image}" alt="${title}">
              </div>
              <div class="cs-card-copy"><h3>${title}</h3><p>${description}</p></div>
            </article>`).join('')}
          </section>
          <section class="cs-feature cs-feature--specialties">
            <div class="cs-editorial-photo reveal"><img src="images/spots/wep-optimized/condiments06.webp" alt="Specialty condiments and culinary spreads"></div>
            <div class="cs-copy reveal">
              <span class="eyebrow">Beyond the Essentials</span>
              <h2>Beyond the Everyday Essentials</h2>
              <p>Exceptional cooking often depends on ingredients that bring something unexpected to the table. From richly flavored preparations to distinctive culinary specialties, sauces and condiments offer a remarkable range of creative possibilities.</p>
              <p>Our approach celebrates this diversity through carefully considered selections for both traditional dishes and contemporary menus.</p>
            </div>
          </section>
          <section class="cs-origins">
            <div class="cs-origins-copy reveal">
              <span class="eyebrow">Inspired by Tradition</span>
              <h2>Inspired by Culinary Traditions</h2>
              <p>Across regions and generations, distinctive sauces and condiments have helped define the character of local cuisines.</p>
              <p>These specialties reflect the ingredients, traditions, and flavor preferences that make regional cooking unique.</p>
            </div>
            <div class="cs-origin-list reveal${verifiedStyles.length ? '' : ' is-pending'}" aria-label="Verified condiment styles and culinary traditions">
              ${verifiedStyles.length
                ? verifiedStyles.map((style) => `<span>${style}</span>`).join('')
                : '<p class="cs-origin-pending">Catalog styles and traditions pending verification.</p>'}
            </div>
            <p class="cs-origin-note">Distinctive ingredients. Authentic traditions. Endless culinary inspiration.</p>
          </section>
          <section class="cs-values">
            <span class="eyebrow">Made for the Professional Table</span>
            <h2>Small Details. Extraordinary Results.</h2>
            <div class="cs-values-grid">
              <div class="cs-value reveal"><h3>Carefully Selected</h3><p>A considered assortment of condiments and sauces chosen for their culinary character and versatility.</p></div>
              <div class="cs-value reveal"><h3>Culinary Versatility</h3><p>Distinctive ingredients for sauces, marinades, dressings, antipasti, finishing, and creative preparations.</p></div>
              <div class="cs-value reveal"><h3>Professional Essentials</h3><p>Specialty food selections suited to restaurants, hotels, gourmet markets, and professional kitchens.</p></div>
            </div>
          </section>
          <section class="cs-close">
            <div class="cs-close-media" role="img" aria-label="A finished dish with sauce and condiments">
              <img src="images/spots/wep-optimized/condiments08.webp" alt="">
            </div>
            <div class="cs-close-copy reveal">
              <span class="eyebrow cs-eyebrow--light">The Art of Exceptional Flavor</span>
              <h2>Every Great Dish Begins with Flavor</h2>
              <p>Explore our selection of sauces, condiments, and culinary specialties, thoughtfully selected for inspired cooking.</p>
            </div>
          </section>
        </div>`;
      },
      confections_and_baked_goods: () => {
        const collections = [
          {
            slot: 'confections-biscuits-card',
            image: 'wep-optimized/confections03.webp',
            title: 'Cookies & Traditional Biscuits',
            description: 'Timeless baked specialties celebrated for their distinctive textures, authentic recipes, and everyday enjoyment.'
          },
          {
            image: 'wep-optimized/confections04.webp',
            title: 'Chocolates & Confections',
            description: 'Rich, delicate, and distinctive sweet creations inspired by confectionery traditions.'
          },
          {
            slot: 'confections-baked-goods-card',
            image: 'wep-optimized/confections05.webp',
            title: 'Specialty Cakes & Baked Goods',
            description: 'Traditional baked favorites and distinctive sweet specialties for memorable occasions.'
          }
        ];
        const verifiedTraditions = [];
        return `
        <div class="cb-page">
          <section class="cb-title reveal">
            <span class="eyebrow">Confections &amp; Baked Goods</span>
            <h2>The Sweet Art of Tradition</h2>
            <span class="cb-title-sub">Exceptional Confections &amp; Baked Specialties</span>
          </section>
          <section class="cb-intro">
            <img class="cb-intro-photo reveal" src="images/spots/wep-optimized/confections01.webp" alt="Traditional artisan biscuits and confections">
            <div class="cb-intro-copy reveal">
              <span class="eyebrow">The Heart of the Collection</span>
              <h2>A Celebration of Sweet Traditions</h2>
              <p>Across generations, traditional confections and baked specialties have brought people together through distinctive flavors, cherished recipes, and the simple pleasure of sharing something exceptional.</p>
              <p>Prime Line presents a thoughtfully selected collection of sweet specialties for restaurants, hotels, cafés, gourmet retailers, and food professionals who appreciate authenticity and culinary tradition.</p>
            </div>
          </section>
          <section class="cb-feature cb-feature--craft">
            <div class="cb-feature-copy reveal">
              <span class="eyebrow">Made with Tradition</span>
              <h2>Crafted with Passion, Shared with Joy</h2>
              <p>From time-honored recipes to carefully prepared specialty sweets, the world of confectionery reflects a remarkable heritage of craftsmanship, creativity, and regional traditions.</p>
              <p>Each style brings its own personality, offering distinctive textures, aromas, and flavors that make everyday occasions and special celebrations memorable.</p>
              <a href="#cb-collections">Explore Our Collection</a>
            </div>
            <img class="cb-feature-media cb-feature-media--image reveal" src="images/spots/wep-optimized/confections02.webp" alt="Artisanal confectionery">
          </section>
          <section class="cb-trio" id="cb-collections" aria-label="Confections and baked goods editorial categories">
            ${collections.map(({ image, title, description }) => `
            <article class="cb-card reveal">
              <img class="cb-card-media" src="images/spots/${image}" alt="${title}">
              <div class="cb-card-copy"><h3>${title}</h3><p>${description}</p></div>
            </article>`).join('')}
          </section>
          <section class="cb-feature cb-feature--seasonal">
            <img class="cb-feature-media cb-feature-media--image reveal" src="images/spots/wep-optimized/confections06.webp" alt="Traditional seasonal baked specialty">
            <div class="cb-feature-copy reveal">
              <span class="eyebrow">Traditions of Celebration</span>
              <h2>Traditions for Every Celebration</h2>
              <p>Some sweet traditions are inseparable from the moments we celebrate. From treasured holiday recipes to iconic seasonal baked specialties, these creations bring flavor, heritage, and a sense of occasion to the table.</p>
              <p>Selected seasonal collections offer distinctive choices for gifting, hospitality, gourmet retail, and the celebration of meaningful moments.</p>
              <p class="cb-detail">Seasonal product families and availability are pending catalog verification.</p>
            </div>
          </section>
          <section class="cb-origins">
            <div class="cb-origins-copy reveal">
              <span class="eyebrow">Timeless Sweet Heritage</span>
              <h2>A World of Sweet Traditions</h2>
              <p>Across Europe and beyond, generations of confectioners and bakers have developed distinctive regional specialties that reflect local ingredients, culinary customs, and traditions.</p>
              <p>These sweet creations bring a remarkable variety of flavors and styles to the contemporary culinary experience.</p>
            </div>
            <div class="cb-origin-list reveal" aria-label="Verified sweet traditions and category families">
              ${verifiedTraditions.length
                ? verifiedTraditions.map((tradition) => `<span>${tradition}</span>`).join('')
                : '<p class="cb-origin-pending">Sweet traditions and category families pending catalog verification.</p>'}
            </div>
            <p class="cb-origin-note">Distinctive traditions. Memorable flavors. Carefully selected.</p>
          </section>
          <section class="cb-values">
            <span class="eyebrow">Selected for Special Occasions</span>
            <h2>Selected for Memorable Moments</h2>
            <div class="cb-values-grid">
              <div class="cb-value reveal"><h3>Carefully Selected</h3><p>A distinctive assortment chosen for authentic character, culinary appeal, and traditional flavor.</p></div>
              <div class="cb-value reveal"><h3>Sweet Traditions</h3><p>Timeless confectionery and baked specialties that bring character to everyday enjoyment and special occasions.</p></div>
              <div class="cb-value reveal"><h3>Hospitality &amp; Retail</h3><p>Selections suited to cafés, hotels, restaurants, gourmet markets, and specialty retail presentations.</p></div>
            </div>
          </section>
        </div>`;
      },
      antipasto_and_vegetables: () => `
        <section class="cv-title reveal">
          <span class="eyebrow">Antipasto &amp; Vegetables</span>
          <h2>Preserved Vegetables</h2>
          <span class="cv-title-sub">Antipastos &amp; Vegetables</span>
        </section>
        <section class="cv-intro">
          <div class="cv-intro-photo reveal"><img src="images/spots/wep-optimized/agnoni1.webp" alt="Balsamic-glazed onions and grilled mushrooms, rustic Italian kitchen"></div>
          <div class="cv-intro-copy reveal">
            <span class="eyebrow">Curated for Professional Kitchens</span>
            <h2>Exceptional Ingredients. Endless Possibilities.</h2>
            <p>Prime Line sources a distinctive selection of preserved vegetables and Mediterranean specialties chosen for their flavor, consistency, and presentation.</p>
            <p>From everyday essentials to harder-to-find delicacies, our portfolio helps chefs create memorable dishes without compromising quality.</p>
          </div>
        </section>
        <section class="cv-trio">
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/wep-optimized/Primizia Artichokes VE59.webp" alt="Artichoke hearts, whole and halved" style="object-position: left center;">
            <div class="cv-trio-label"><h3>Artichokes</h3><p>Tender, flavorful and remarkably versatile, from antipasti and salads to pizzas, pastas and signature entrées.</p></div>
          </a>
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/wep-optimized/deliziedicalabria02.webp" alt="Hand-harvesting fresh Calabrian chili peppers into a crate">
            <div class="cv-trio-label"><h3>Peppers</h3><p>Fiery Calabrian chilies, sun-ripened and hand-harvested for bold, authentic heat.</p></div>
          </a>
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/wep-optimized/cappers.webp" alt="Capers in a rustic wooden bowl">
            <div class="cv-trio-label"><h3>Capers</h3><p>Hand-harvested on Pantelleria, off the southern coast of Italy, prized for their delicate texture and briny, aromatic flavor.</p></div>
          </a>
        </section>
        <section class="cv-spot">
          <div class="cv-spot-copy reveal">
            <span class="eyebrow">A Closer Look</span>
            <h2>The Art of Antipasto</h2>
            <p>Roasted and grilled over open flame, then rested in oil to develop deep, smoky sweetness. This is antipasto the way Sicilian kitchens have always made it.</p>
            <p>Our selection includes artichokes, eggplants, mixed mushrooms, peppers, tomatoes and zucchini, each prepared to be ready for the table in minutes.</p>
            <a href="#">Discover Our Antipasto Selection</a>
          </div>
          <div class="cv-spot-photo reveal"><img src="images/spots/wep-optimized/buscema1.webp" alt="Assorted grilled and roasted vegetable antipasti in oil"></div>
        </section>
        <section class="cv-tips reveal">
          <span class="eyebrow">From Our Table</span>
          <h2>Simple Ways to Elevate the Menu</h2>
          <p>Our assortment spans the full range of Mediterranean preserved vegetables: tender artichokes and hearts, sweet and hot peppers roasted or stuffed, giardiniera and cornichons, capers in salt or oil, sun-dried and semi-dried tomatoes, marinated grape leaves and specialty accompaniments like hearts of palm and preserved lemons. Every item is chosen for consistent quality, practical formats and the authentic flavor chefs expect from true Mediterranean sourcing.</p>
        </section>
        <section class="cv-icons">
          <div class="cv-icons-row">
            <div class="cv-icon-item reveal"><img src="images/icons/artich.png" alt="Artichokes"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/peppers.png" alt="Peppers"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/miscveg.png" alt="Giardiniera"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/cornich.png" alt="Cornichons"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/capers.png" alt="Capers"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/drytom.png" alt="Sun-dried tomatoes"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/grapeleave.png" alt="Grape leaves"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/heartpalm.png" alt="Hearts of palm"></div>
            <div class="cv-icon-item reveal"><img src="images/icons/lemon.png" alt="Preserved lemons"></div>
          </div>
        </section>
        <section class="cv-diff">
          <span class="eyebrow">A Collection Built for Food Professionals</span>
          <div class="cv-diff-grid">
            <div class="cv-diff-item reveal"><h4>Carefully Selected</h4><p>Products chosen for authentic flavor, texture and visual appeal.</p></div>
            <div class="cv-diff-item reveal"><h4>Kitchen Ready</h4><p>Practical formats created for consistency and efficiency.</p></div>
            <div class="cv-diff-item reveal"><h4>Broad Assortment</h4><p>Classic Mediterranean staples and specialty ingredients from trusted producers.</p></div>
          </div>
        </section>
        <section class="cv-close">
          <img src="images/spots/wep-optimized/deliziedicalabria01.webp" alt="Calabrian chili peppers, freshly harvested on a hillside overlooking the coast">
          <div class="cv-close-content reveal">
            <span class="eyebrow cv-eyebrow--light">Grown in Calabria, Italy</span>
            <h1>Sun-Ripened, Hand-Harvested, Truly Authentic</h1>
            <p>From sun-drenched hillsides overlooking the Ionian coast, our Calabrian chili peppers are hand-harvested at their peak and prepared using time-honored methods, bringing fiery, authentic flavor to every dish.</p>
          </div>
        </section>`,
    };

    function defaultDetailTemplate(data) {
      const action = data.title === 'Crafted for the Art of Pastry'
        ? '<a class="btn btn--dark banner-caption-action" href="home.html?category=baking_and_pastry#categoryDetail">Explore the Full Collection</a>'
        : '';
      return `
        <section class="banner-caption">
          <div class="banner-caption-inner">
            <span class="eyebrow banner-caption-eyebrow">${data.eyebrow}</span>
            <h2 class="banner-caption-title">${data.title}</h2>
            <p class="banner-caption-text">${data.text}</p>
            ${action}
          </div>
        </section>`;
    }

    const categoryDetail = document.getElementById('categoryDetail');
    let categoryDetailTimer;
    const categoryDetailNodes = new Map();

    function updateCategoryDetail(slideEl) {
      if (!categoryDetail) return;
      const media = slideEl.querySelector('img, video');
      const mediaSrc = media?.getAttribute('src') || media?.querySelector('source')?.getAttribute('src') || media?.querySelector('source')?.dataset.src || media?.dataset.src || '';
      const key = slideEl.dataset.category || decodeURIComponent(mediaSrc.split('/').pop() || '').replace(/\.[^.]+$/, '');
      const data = bannerCopy[key] || { eyebrow: 'Prime Line', title: media?.getAttribute('alt') || 'Category', text: 'Reference text coming soon.' };
      const render = categoryDetailTemplates[key] || (() => defaultDetailTemplate(data));
      clearTimeout(categoryDetailTimer);
      categoryDetail.classList.add('is-fading');
      categoryDetailTimer = setTimeout(() => {
        let nodes = categoryDetailNodes.get(key);
        if (!nodes) {
          const template = document.createElement('template');
          template.innerHTML = render();
          nodes = Array.from(template.content.childNodes);
          categoryDetailNodes.set(key, nodes);
        }
        categoryDetail.replaceChildren(...nodes);
        categoryDetail.classList.remove('is-fading');
        categoryDetail.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      }, 300);
    }

    const initSlider = () => {
      const slides = Array.from(track.querySelectorAll('.slide'));
      if (!slides.length) return;
      const requestedCategory = new URLSearchParams(window.location.search).get('category');
      const requestedIndex = requestedCategory
        ? slides.findIndex((slide) => {
          const media = slide.querySelector('img, video');
          const src = media?.getAttribute('src') || media?.querySelector('source')?.dataset.src || media?.dataset.src || '';
          if (slide.dataset.category === requestedCategory) return true;
          return decodeURIComponent(src.split('/').pop() || '').replace(/\.[^.]+$/, '') === requestedCategory;
        })
        : -1;
      let current = requestedIndex >= 0
        ? requestedIndex
        : Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
      slides.forEach((slide, index) => slide.classList.toggle('is-active', index === current));
      const preparedSlides = new WeakSet();
      function prepareSlideMedia(index) {
        const slide = slides[(index + slides.length) % slides.length];
        if (preparedSlides.has(slide)) return;
        const image = slide.querySelector('img');
        if (image?.dataset.src) {
          image.src = image.dataset.src;
          image.loading = 'eager';
          image.decoding = 'async';
        }
        const video = slide.querySelector('video');
        const source = video?.querySelector('source');
        if (video && source?.dataset.src) {
          if (video.dataset.poster) video.poster = video.dataset.poster;
          video.preload = 'auto';
          source.src = source.dataset.src;
          video.load();
        }
        preparedSlides.add(slide);
      }
      prepareSlideMedia(current);
      prepareSlideMedia(current + 1);
      let timer;
      let autoplayAllowed = true;
      let pointerOverCategoryDetail = false;
      let videoAdvancePending = false;
      const keyboardToast = document.getElementById('sliderKeyboardToast');
      const keyboardToastCountKey = 'primeLineSliderPointerHintVisitsV3';
      let keyboardToastCountedThisVisit = false;

      dotsWrap.textContent = '';
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'dot' + (i === current ? ' is-active' : '');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
      });
      const dots = Array.from(dotsWrap.children);
      slides.forEach((slide) => {
        const video = slide.querySelector('video');
        if (!video) return;
        video.loop = false;
        video.addEventListener('ended', () => {
          if (slides[current] !== slide) return;
          videoAdvancePending = true;
          advanceAfterVideo();
        });
      });
      updateCategoryDetail(slides[current]);
      slides.forEach((slide, index) => {
        const video = slide.querySelector('video');
        if (!video) return;
        if (index === current) {
          video.currentTime = 0;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
      function goTo(index) {
        videoAdvancePending = false;
        const previousVideo = slides[current].querySelector('video');
        previousVideo?.pause();
        slides[current].classList.remove('is-active');
        dots[current].classList.remove('is-active');
        current = (index + slides.length) % slides.length;
        prepareSlideMedia(current);
        prepareSlideMedia(current + 1);
        slides[current].classList.add('is-active');
        dots[current].classList.add('is-active');
        const nextVideo = slides[current].querySelector('video');
        if (nextVideo) {
          nextVideo.currentTime = 0;
          nextVideo.play().catch(() => {});
        }
        updateCategoryDetail(slides[current]);
        resetTimer();
      }
      function showKeyboardToast(target) {
        if (!keyboardToast || !(target instanceof Element)) return;
        // The hint is shown during the first 10 visits; each visit counts once, however many times the pointer hovers.
        if (!keyboardToastCountedThisVisit) {
          let visits = 0;
          try {
            visits = Number.parseInt(localStorage.getItem(keyboardToastCountKey) || '0', 10) || 0;
          } catch (error) {
            visits = 0;
          }
          if (visits >= 10) return;
          keyboardToastCountedThisVisit = true;
          try {
            localStorage.setItem(keyboardToastCountKey, String(visits + 1));
          } catch (error) {
            // Storage unavailable: still show the hint for this visit.
          }
        }
        const sliderRect = slider.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const toastWidth = keyboardToast.getBoundingClientRect().width;
        const targetCenter = targetRect.left - sliderRect.left + targetRect.width / 2;
        const minLeft = toastWidth / 2 + 12;
        const maxLeft = sliderRect.width - toastWidth / 2 - 12;
        const left = Math.max(minLeft, Math.min(targetCenter, maxLeft));
        const top = Math.max(8, targetRect.top - sliderRect.top - 10);
        keyboardToast.style.left = `${left}px`;
        keyboardToast.style.top = `${top}px`;
        keyboardToast.setAttribute('aria-hidden', 'false');
        keyboardToast.classList.add('is-visible');
      }
      const hideKeyboardToast = () => {
        keyboardToast?.classList.remove('is-visible');
        keyboardToast?.setAttribute('aria-hidden', 'true');
      };
      slider.addEventListener('pointerover', (event) => {
        if ((event.pointerType && event.pointerType !== 'mouse') || !(event.target instanceof Element)) return;
        const control = event.target.closest('.slider-arrow, .slider-dots .dot');
        if (control) showKeyboardToast(control);
      });
      slider.addEventListener('pointerout', (event) => {
        if (!(event.target instanceof Element) || !event.target.closest('.slider-arrow, .slider-dots .dot')) return;
        if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.slider-arrow, .slider-dots .dot')) return;
        hideKeyboardToast();
      });
      categoryDetail?.addEventListener('click', (e) => {
        const catalogLink = e.target.closest('.catalog-trigger');
        if (catalogLink) {
          e.preventDefault();
          catalogTriggers[0]?.click();
          return;
        }
      });
      function resetTimer() {
        clearTimeout(timer);
        if (videoAdvancePending) {
          advanceAfterVideo();
          return;
        }
        if (!autoplayAllowed || pointerOverCategoryDetail) return;
        const slide = slides[current];
        const video = slide.querySelector('video');
        if (video) return;
        timer = setTimeout(() => goTo(current + 1), 5000);
      }
      function advanceAfterVideo() {
        if (!videoAdvancePending || !autoplayAllowed || pointerOverCategoryDetail || slider.matches(':hover')) return;
        videoAdvancePending = false;
        goTo(current + 1);
      }

      slider.setAttribute('tabindex', '0');
      slider.setAttribute('aria-label', 'Featured categories slider');
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const target = e.target;
        if (target instanceof Element && (
          target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
        )) return;
        if (document.querySelector('.spot-lightbox.is-open, .nav-overlay.is-open, .side-drawers .is-open, .contact-panel.is-open, .about-panel.is-open, .catalog-panel.is-open, .masterlink-panel.is-open, .order-entry-panel.is-open, .account-forms-panel.is-open, .locations-panel.is-open')) return;
        if (window.scrollY > 0) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        e.preventDefault();
        goTo(current + (e.key === 'ArrowLeft' ? -1 : 1));
      });
      slider.addEventListener('keydown', (e) => {
        if (e.key === 'Home') {
          e.preventDefault();
          goTo(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          goTo(slides.length - 1);
        }
      });
      slider.addEventListener('mouseenter', () => clearTimeout(timer));
      slider.addEventListener('mouseleave', (event) => {
        if (categoryDetail && event.relatedTarget instanceof Node && categoryDetail.contains(event.relatedTarget)) {
          pointerOverCategoryDetail = true;
        }
        resetTimer();
      });
      slider.addEventListener('focusin', () => clearTimeout(timer));
      slider.addEventListener('focusout', (e) => {
        if (!slider.contains(e.relatedTarget)) resetTimer();
      });
      categoryDetail?.addEventListener('mouseenter', () => {
        pointerOverCategoryDetail = true;
        clearTimeout(timer);
      });
      categoryDetail?.addEventListener('mouseleave', () => {
        pointerOverCategoryDetail = false;
        resetTimer();
      });

      // Pause autoplay as soon as the banner starts leaving the viewport (user reading the category detail below); resume only once it's fully back on screen.
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        autoplayAllowed = entry.intersectionRatio >= 0.99;
        if (autoplayAllowed) resetTimer();
        else clearTimeout(timer);
      }, { threshold: [0, 0.99, 1] });
      visibilityObserver.observe(slider);

      prevBtn.addEventListener('click', () => goTo(current - 1));
      nextBtn.addEventListener('click', () => goTo(current + 1));
      resetTimer();
    };

    initSlider();
  }
});
