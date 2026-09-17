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
    if (e.target.closest('.slider-arrow, .detail-slider-arrow')) return;
    const spotModule = e.target.closest('.cheese-card, .cheese-feature, .cheese-close, .category-detail, .cv-hero, .cv-intro, .cv-trio-card, .cv-spot, .cv-diff, .cv-close');
    const image = e.target.closest('img') || spotModule?.querySelector('img');
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
    const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 60);
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

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('is-open'));
  }

  const simpleHeader = document.querySelector('.site-header-simple');
  if (simpleHeader) {
    const onScrollSimple = () => simpleHeader.classList.toggle('is-scrolled', window.scrollY > 10);
    onScrollSimple();
    window.addEventListener('scroll', onScrollSimple, { passive: true });
  }

  const menuToggle = document.querySelector('.menu-toggle');
  const navPanel = document.querySelector('.nav-panel');
  const navOverlay = document.querySelector('.nav-overlay');
  const navPanelClose = document.querySelector('.nav-panel-close');
  const contactPanel = document.querySelector('.contact-panel');
  const contactPanelClose = document.querySelector('.contact-panel-close');
  const contactTriggers = document.querySelectorAll('.contact-trigger');
  const locationsPanel = document.querySelector('.locations-panel');
  const aboutPanel = document.querySelector('.about-panel');
  const aboutPanelClose = document.querySelector('.about-panel-close');
  const aboutTriggers = document.querySelectorAll('.about-trigger');
  const catalogPanel = document.querySelector('.catalog-panel');
  const catalogPanelClose = document.querySelector('.catalog-panel-close');
  const catalogTriggers = document.querySelectorAll('.catalog-trigger');
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
  const curtainTransitionMs = 500;

  const contactInfo = document.querySelector('.contact-info');

  // Collapses locations, then contact, one step at a time - never all at once.
  const closeContact = (onClosed) => {
    locationsPanel?.classList.remove('is-open');
    locationsPanel?.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      contactPanel?.classList.remove('is-open');
      contactPanel?.setAttribute('aria-hidden', 'true');
      contactInfo?.classList.remove('is-open');
      if (onClosed) setTimeout(onClosed, curtainTransitionMs);
    }, 200);
  };

  const closeAbout = (onClosed) => {
    aboutPanel?.classList.remove('is-open');
    aboutPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeCatalog = (onClosed) => {
    catalogPanel?.classList.remove('is-open');
    catalogPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeMasterlink = (onClosed) => {
    masterlinkPanel?.classList.remove('is-open');
    masterlinkPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeCatalogPdf = (onClosed) => {
    catalogPdfPanel?.classList.remove('is-open');
    catalogPdfPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeOrderEntry = (onClosed) => {
    orderEntryPanel?.classList.remove('is-open');
    orderEntryPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  const closeAccountForms = (onClosed) => {
    accountFormsPanel?.classList.remove('is-open');
    accountFormsPanel?.setAttribute('aria-hidden', 'true');
    if (onClosed) setTimeout(onClosed, curtainTransitionMs);
  };

  if (menuToggle && navPanel && navOverlay) {
    const openMenu = () => {
      navPanel.classList.add('is-open');
      navOverlay.classList.add('is-open');
      navPanel.setAttribute('aria-hidden', 'false');
      menuToggle.setAttribute('aria-expanded', 'true');
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
        navPanel.setAttribute('aria-hidden', 'true');
        menuToggle.setAttribute('aria-expanded', 'false');
      }, (hadContactOpen || hadAboutOpen || hadCatalogOpen || hadMasterlinkOpen || hadCatalogPdfOpen || hadOrderEntryOpen || hadAccountFormsOpen) ? 420 : 0);
    };
    menuToggle.addEventListener('click', openMenu);
    navOverlay.addEventListener('click', closeMenu);
    navPanelClose?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // Contact opens as a second curtain alongside the menu, with locations as a third. Clicking another curtain closes this one first.
  if (contactPanel && contactTriggers.length) {
    const openContact = (e) => {
      e.preventDefault();
      if (contactPanel.classList.contains('is-open')) {
        closeContact();
        return;
      }
      const showContact = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        contactPanel.classList.add('is-open');
        contactPanel.setAttribute('aria-hidden', 'false');
        contactInfo?.classList.add('is-open');
        locationsPanel?.classList.add('is-open');
        locationsPanel?.setAttribute('aria-hidden', 'false');
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeContact();
    });
    contactPanel.querySelector('.contact-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      closeContact();
    });
  }

  // About Us opens as its own curtain alongside the menu. Clicking another curtain closes this one first.
  if (aboutPanel && aboutTriggers.length) {
    const openAbout = (e) => {
      e.preventDefault();
      if (aboutPanel.classList.contains('is-open')) {
        closeAbout();
        return;
      }
      const showAbout = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        aboutPanel.classList.add('is-open');
        aboutPanel.setAttribute('aria-hidden', 'false');
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
      const destination = e.currentTarget.dataset.catalogUrl;
      const showCatalog = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        catalogPanel.classList.add('is-open');
        catalogPanel.setAttribute('aria-hidden', 'false');
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

  const setupEmailCodeAccess = (panel, resourceName) => {
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
        showStatus('Access granted.');
      } catch {
        showStatus('We could not verify the code. Please try again.', true);
      } finally {
        if (button) button.disabled = false;
      }
    });

    codeInput?.addEventListener('input', () => {
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 3);
    });

    backButton?.addEventListener('click', () => {
      email = '';
      emailForm.hidden = false;
      codeForm.hidden = true;
      backButton.hidden = true;
      codeInput.value = '';
      if (lead) lead.textContent = 'Enter your company email to receive a 3-digit access code.';
      showStatus('');
      emailInput?.focus();
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
    const openCatalogPdf = (e) => {
      e.preventDefault();
      const showCatalogPdf = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        catalogPdfPanel.classList.add('is-open');
        catalogPdfPanel.setAttribute('aria-hidden', 'false');
      };
      if (catalogPdfPanel.classList.contains('is-open')) {
        closeCatalogPdf();
      } else if (contactPanel?.classList.contains('is-open')) {
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

    setupEmailCodeAccess(catalogPdfPanel, 'catalog-pdf');
  }

  if (orderEntryPanel && orderEntryTriggers.length) {
    const openOrderEntry = (e) => {
      e.preventDefault();
      const showOrderEntry = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        orderEntryPanel.classList.add('is-open');
        orderEntryPanel.setAttribute('aria-hidden', 'false');
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
      const showAccountForms = () => {
        navPanel?.classList.add('is-open');
        navOverlay?.classList.add('is-open');
        navPanel?.setAttribute('aria-hidden', 'false');
        accountFormsPanel.classList.add('is-open');
        accountFormsPanel.setAttribute('aria-hidden', 'false');
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
    const bannerDir = track.dataset.bannerDir;

    // Auto-discover images from the folder's directory listing (dev server only); falls back to the static markup on failure.
    const autoLoadSlides = async () => {
      if (!bannerDir) return;
      try {
        const res = await fetch(bannerDir);
        if (!res.ok) return;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const files = Array.from(doc.querySelectorAll('a'))
          .map((a) => a.getAttribute('href') || '')
          .filter((href) => /\.(jpe?g|png|webp|gif)$/i.test(href))
          .sort((a, b) => a.localeCompare(b));
        if (!files.length) return;

        track.textContent = '';
        files.forEach((href, i) => {
          const name = decodeURIComponent(href.split('/').pop());
          const alt = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
          const slide = document.createElement('div');
          slide.className = 'slide' + (i === 0 ? ' is-active' : '');
          const img = document.createElement('img');
          img.src = bannerDir + href;
          img.alt = alt;
          slide.appendChild(img);
          track.appendChild(slide);
        });
      } catch {
        // keep the static fallback slides already in the HTML
      }
    };

    // Placeholder copy keyed by image filename (without extension) - replace with final copy per category.
    const bannerCopy = {
      parmigiano: { eyebrow: 'Cheese', title: 'Exceptional Cheese, Selected at the Source', text: 'Parmigiano and international specialties for professional kitchens.' },
      mozzarellaburrata: { eyebrow: 'Fresh Cheese', title: 'Mozzarella & Burrata', text: 'Fresh Italian cheese selected for exceptional texture, flavor and professional service.' },
      antipasto_and_vegetables: { eyebrow: 'Antipasto', title: 'Antipasto & Vegetables', text: 'Reference text about antipasto and vegetables. Replace with final copy.' },
      baking_and_pastry: { eyebrow: 'Baking & Pastry', title: 'Crafted for the Art of Pastry', text: 'Premium ingredients and authentic specialties selected for professional bakers, pastry chefs and culinary creators.' },
      balsamic1: { eyebrow: 'Vinegars', title: 'Balsamic Vinegar', text: 'Reference text about balsamic vinegar. Replace with final copy.' },
      beans_and_legumes: { eyebrow: 'Legumes', title: 'Beans & Legumes', text: 'Reference text about beans and legumes. Replace with final copy.' },
      coffee_and_tea: { eyebrow: 'Coffee & Tea', title: 'Coffee & Tea', text: 'Reference text about coffee and tea. Replace with final copy.' },
      condiments_sauces_and_stocks: { eyebrow: 'Condiments', title: 'Condiments, Sauces & Stocks', text: 'Reference text about condiments. Replace with final copy.' },
      confections_and_baked_goods: { eyebrow: 'Confections', title: 'Confections & Baked Goods', text: 'Reference text about confections. Replace with final copy.' },
      cured_meats: { eyebrow: 'Charcuterie', title: 'Italian Cured Meats', text: 'A complete charcuterie collection, from pancetta and salami to sopressata, mortadella and regional specialties.' },
      prosciutto: { eyebrow: 'Charcuterie', title: 'Prosciutto', text: 'Italian prosciutto selected for its delicate texture, balanced flavor and authentic regional character.' },
      desserts_and_gelato: { eyebrow: 'Desserts', title: 'Desserts & Gelato', text: 'Reference text about desserts. Replace with final copy.' },
      gelato: { eyebrow: 'Italian Gelato', title: 'Gelati Italiani', text: 'Authentic Italian gelato selected for remarkable flavor, creamy texture and professional service.' },
      fish_and_seafood: { eyebrow: 'Seafood', title: 'Fish & Seafood', text: 'A considered collection of fish and seafood selected for quality, versatility and professional kitchen service.' },
      flour_rice_and_grains: { eyebrow: 'Pantry Essentials', title: 'Flour, Rice & Grains', text: 'Exceptional flours, Italian rice and grains selected for texture, performance and professional kitchens.' },
      'olivesand oil': { eyebrow: 'Oils', title: 'Olives & Oil', text: 'Reference text about olives and oil. Replace with final copy.' },
      pasta: { eyebrow: 'Pasta', title: 'Italian Pasta', text: 'We sell the finest pasta from Italy. Replace with final copy.' },
    };

    // Centralized placeholders: replace these paths when the final cheese photography arrives.
    const cheeseImages = {
      hero: 'images/banners/parmigiano.jpg',
      parmigiano: 'images/banners/parmigiano.jpg',
      agedFirm: 'images/banners/parmigiano.jpg',
      alpine: 'images/spots/gruyere01.png',
      blue: 'images/spots/gorgonzola01.png',
      italy: 'images/spots/cheesesmisce.png',
      world: 'images/spots/romacheese.jpg',
    };

    // Full rich landing (intro/trio/spot/tips/diff/close) for categories with final copy - others fall back to a simple caption.
    const categoryDetailTemplates = {
      baking_and_pastry: () => `
        <div class="bp-page">
          <section class="bp-intro" id="baking-collection">
            <div class="bp-intro-photo reveal"><img src="images/banners/baking_and_pastry.jpeg" alt="Traditional cannoli prepared with pastry cream and pistachio" style="object-position: 34% center;"></div>
            <div class="bp-copy reveal"><span class="eyebrow">A Considered Collection</span><h2>Where Craft Meets Ingredient</h2><p>From fine chocolate and aromatic vanilla to delicate pastry shells and traditional Italian specialties, our collection brings together the ingredients professionals trust to create exceptional desserts.</p></div>
          </section>
          <section class="bp-feature bp-feature--essentials">
            <div class="bp-copy reveal"><span class="eyebrow">01 &nbsp; Baking Essentials</span><h2>The Essentials Behind Every Creation</h2><p>Carefully selected ingredients that bring aroma, structure, texture and consistency to every recipe.</p><p class="bp-detail">Vanilla beans, extracts and paste sit alongside almond and coffee extracts, orange blossom water, honey, gelatin, yeast and puff pastry sheets.</p></div>
            <div class="bp-media bp-media--pending reveal" role="img" aria-label="Pending baking essentials photography"><span>Photography to be placed:<br><strong>images/spots/baking-essentials.jpg</strong></span></div>
          </section>
          <section class="bp-feature bp-feature--chocolate">
            <div class="bp-media bp-media--pending reveal" role="img" aria-label="Pending professional chocolate photography"><span>Photography to be placed:<br><strong>images/spots/professional-chocolate.jpg</strong></span></div>
            <div class="bp-copy bp-copy--light reveal"><span class="eyebrow bp-eyebrow-light">02 &nbsp; Professional Chocolate</span><h2>Chocolate Without Compromise</h2><p>Professional couverture, callets, cocoa and pastry fillings created for precision, performance and remarkable flavor.</p><p class="bp-detail">Callebaut chocolate blocks, callets, chocolate chips, cocoa powder and white chocolate for pastry work that demands control and depth.</p></div>
          </section>
          <section class="bp-feature bp-feature--finishing">
            <div class="bp-copy reveal"><span class="eyebrow">03 &nbsp; Amarena &amp; Finishing</span><h2>The Perfect Finishing Touch</h2><p>Distinctive fruit, glazes and finishing ingredients that transform every dessert into a memorable presentation.</p><p class="bp-detail">Toschi Amarena cherries, cherries in syrup and refined finishing ingredients for pastry chefs who understand the final detail.</p></div>
            <div class="bp-media bp-media--pending reveal" role="img" aria-label="Pending fruit and finishing ingredients photography"><span>Photography to be placed:<br><strong>images/spots/amarena-finishing.jpg</strong></span></div>
          </section>
          <section class="bp-cannoli">
            <div class="bp-cannoli-photo reveal"><img src="images/banners/baking_and_pastry.jpeg" alt="Crisp Sicilian cannoli filled with ricotta cream and finished with pistachio" style="object-position: 31% 63%;"></div>
            <div class="bp-cannoli-copy reveal"><span class="eyebrow">04 &nbsp; Cannoli</span><h2>A Sicilian Classic, Ready to Create</h2><p>Crisp traditional shells and rich Sicilian ricotta cream bring authentic flavor, texture and character to every cannolo.</p><p class="bp-detail">Large and mini cannoli shells, ricotta cream and professional ingredients for an unmistakably Sicilian finish.</p></div>
          </section>
          <section class="bp-feature bp-feature--specialties">
            <div class="bp-copy reveal"><span class="eyebrow">05 &nbsp; Italian Pastry Specialties</span><h2>Layers of Italian Tradition</h2><p>Delicate, crisp and unmistakably Italian, our pastry specialties bring authentic craftsmanship to today&apos;s professional kitchen.</p><p class="bp-detail">Sfogliatella and other traditional Italian bakery products selected for pastry shops, hotels, restaurants and chefs.</p></div>
            <div class="bp-media bp-media--pending reveal" role="img" aria-label="Pending sfogliatella photography"><span>Photography to be placed:<br><strong>images/spots/sfogliatella.jpg</strong></span></div>
          </section>
          <section class="bp-close">
            <div class="bp-media bp-media--pending bp-media--close reveal" role="img" aria-label="Pending Le Delizie cannoli photography"><span>Photography to be placed:<br><strong>images/spots/ledelizie.jpg</strong></span></div>
            <div class="bp-close-copy reveal"><span class="eyebrow bp-eyebrow-light">Le Delizie</span><h2>Authentic Cannoli, Made Effortless</h2><p>Le Delizie brings together traditional Sicilian cannoli shells and rich ricotta cream, giving professionals everything they need to create an authentic Italian favorite.</p></div>
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
          <div class="cheese-feature-photo reveal"><img class="cheese-image" src="images/spots/gennari01.jpg" alt="Parmigiano Reggiano wheels and cheese tools in an Italian aging room" style="object-position: 70% center;"></div>
        </section>
        <section class="cheese-trio">
          <article class="cheese-card reveal">
            <img class="cheese-image" src="images/spots/pecorino01.jpg" alt="Pecorino cheese from an Italian producer" style="object-position: 12% center;">
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
      desserts_and_gelato: () => `
        <div class="dg-page">
          <section class="dg-title reveal"><span class="eyebrow">Desserts &amp; Gelato</span><h2>The Pleasure of a Beautiful Finish</h2><span class="dg-title-sub">Gelato, Desserts &amp; Italian Sweet Specialties</span></section>
          <section class="dg-intro"><div class="dg-intro-photo reveal"><img src="images/categories/desserts_and_gelato.jpg" alt="Desserts and gelato prepared for hospitality service"></div><div class="dg-intro-copy reveal"><span class="eyebrow">Made for Memorable Moments</span><h2>Every Great Meal Deserves a Final Note</h2><p>Prime Line selects desserts and gelato that bring comfort, color and a sense of occasion to every kind of hospitality service.</p><p>From the display case to the final course, our collection gives professionals a dependable way to delight guests and complete the experience.</p></div></section>
          <section class="dg-feature dg-feature--gelato"><div class="dg-feature-copy reveal"><span class="eyebrow">01 &nbsp; Gelato</span><h2>Italian Tradition, Served with Imagination</h2><p>Silky texture, vivid flavor and a generous sense of pleasure make gelato a natural centerpiece for restaurants, cafes and dessert programs.</p><p class="dg-detail">Classic and creative flavors for cups, cones, plated desserts, menus and moments worth lingering over.</p></div><div class="dg-feature-media dg-media--gelato reveal"><span>Photography to be placed:<br><strong>images/spots/gelato-service.jpg</strong></span></div></section>
          <section class="dg-trio"><article class="dg-card reveal"><div class="dg-card-media dg-card-media--gelato"><span>Photography to be placed:<br><strong>images/spots/gelato.jpg</strong></span></div><div class="dg-card-copy"><h3>Gelato</h3><p>Rich, smooth and expressive flavors for an unmistakably Italian finish.</p></div></article><article class="dg-card reveal"><div class="dg-card-media dg-card-media--desserts"><span>Photography to be placed:<br><strong>images/spots/italian-desserts.jpg</strong></span></div><div class="dg-card-copy"><h3>Desserts</h3><p>Classic favorites and distinctive specialties ready for memorable service.</p></div></article><article class="dg-card reveal"><div class="dg-card-media dg-card-media--frozen"><span>Photography to be placed:<br><strong>images/spots/frozen-specialties.jpg</strong></span></div><div class="dg-card-copy"><h3>Frozen Specialties</h3><p>Effortless desserts with the quality and appeal guests expect.</p></div></article></section>
          <section class="dg-feature dg-feature--service"><div class="dg-feature-media dg-media--service reveal"><img src="images/banners/desserts_and_gelato.jpeg" alt="Desserts and gelato presented for professional service"></div><div class="dg-feature-copy reveal"><span class="eyebrow">02 &nbsp; Built for Every Service</span><h2>From Display Case to Final Course</h2><p>Whether you are creating a signature dessert, filling a gelato counter or offering a simple sweet finish, our assortment gives every service a little more color and character.</p><a href="#">Discover Our Dessert Selection</a></div></section>
          <section class="dg-origins reveal"><span class="eyebrow">A Tradition of Sweetness</span><h2>Italian Classics and Global Inspiration</h2><p>Our assortment brings together beloved Italian specialties and expressive desserts selected for the way hospitality professionals serve today.</p><div class="dg-origin-list"><span>Italy</span><span>France</span><span>Spain</span><span>United States</span><span>Global</span></div></section>
          <section class="dg-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="dg-values-grid"><div class="dg-value reveal"><h3>Ready to Delight</h3><p>Selections that make a memorable dessert service feel effortless.</p></div><div class="dg-value reveal"><h3>Beautifully Versatile</h3><p>Products for display cases, plated desserts and everyday occasions.</p></div><div class="dg-value reveal"><h3>True Indulgence</h3><p>Flavor, texture and presentation designed to leave an impression.</p></div></div></section>
          <section class="dg-close"><div class="dg-close-media"><span>Photography to be placed:<br><strong>images/spots/desserts-gelato-close.jpg</strong></span></div><div class="dg-close-copy reveal"><span class="eyebrow dg-eyebrow--light">The Sweetest Part</span><h2>Leave Guests with Something to Remember</h2><p>Prime Line gives chefs and hospitality teams desserts and gelato that turn the final course into a lasting impression.</p><div class="dg-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      flour_rice_and_grains: () => `
        <div class="frg-page">
          <section class="frg-title reveal"><span class="eyebrow">Flour, Rice &amp; Grains</span><h2>The Foundations of Italian Cooking</h2><span class="frg-title-sub">Specialty Flours, Italian Rice &amp; Pantry Grains</span></section>
          <section class="frg-intro"><div class="frg-intro-photo reveal"><img src="images/categories/flour_rice_and_grains.jpg" alt="Flour, rice and grains selected for professional kitchens"></div><div class="frg-intro-copy reveal"><span class="eyebrow">A Considered Pantry</span><h2>Every Great Dish Starts with the Right Foundation</h2><p>Prime Line selects the flours, rice and grains that give chefs consistency, texture and the confidence to create from the first step.</p><p>From a delicate pizza dough to a perfectly finished risotto, these pantry essentials bring authentic character and dependable performance to the working kitchen.</p></div></section>
          <section class="frg-feature frg-feature--flour"><div class="frg-feature-copy reveal"><span class="eyebrow">01 &nbsp; Specialty Flours</span><h2>Precision Begins with the Grain</h2><p>Exceptional flour gives dough its structure, texture and expression. Our selection supports everything from bread and pizza to pasta, pastry and regional specialties.</p><p class="frg-detail">Professional flours chosen for the recipes, fermentation styles and consistent results today&apos;s kitchens demand.</p></div><div class="frg-feature-media reveal"><img src="images/banners/flour_rice_and_grains.jpeg" alt="Specialty flour and grains for Italian cooking"></div></section>
          <section class="frg-trio"><article class="frg-card reveal"><div class="frg-card-media frg-card-media--flour"><span>Photography to be placed:<br><strong>images/spots/specialty-flours.jpg</strong></span></div><div class="frg-card-copy"><h3>Specialty Flours</h3><p>Reliable performance for pizza, pasta, bread, pastry and everyday preparation.</p></div></article><article class="frg-card reveal"><div class="frg-card-media frg-card-media--rice"><span>Photography to be placed:<br><strong>images/spots/italian-rice.jpg</strong></span></div><div class="frg-card-copy"><h3>Italian Rice</h3><p>Arborio, Carnaroli and other essential varieties for creamy, expressive risotto.</p></div></article><article class="frg-card reveal"><div class="frg-card-media frg-card-media--grains"><span>Photography to be placed:<br><strong>images/spots/grains-polenta.jpg</strong></span></div><div class="frg-card-copy"><h3>Grains &amp; Polenta</h3><p>Versatile pantry staples for composed dishes, sides and regional Italian cooking.</p></div></article></section>
          <section class="frg-feature frg-feature--service"><div class="frg-feature-media reveal"><img src="images/categories/flour_rice_and_grains.jpg" alt="Rice, flour and grains for professional service"></div><div class="frg-feature-copy reveal"><span class="eyebrow">02 &nbsp; Built for the Working Kitchen</span><h2>From First Measure to Final Plate</h2><p>Whether you are shaping fresh pasta, building a bread program or cooking risotto to order, our collection gives chefs the ingredients to work with clarity and confidence.</p><a href="#">Discover Our Flour, Rice &amp; Grains Selection</a></div></section>
          <section class="frg-origins reveal"><span class="eyebrow">The Pantry, Region by Region</span><h2>Ingredients with a Sense of Place</h2><p>Our selection reflects Italy&apos;s rich grain traditions, from the rice fields of the north to the wheat-growing regions and corn mills that shape its regional cooking.</p><div class="frg-origin-list"><span>Piedmont</span><span>Lombardy</span><span>Veneto</span><span>Emilia-Romagna</span><span>Southern Italy</span></div></section>
          <section class="frg-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="frg-values-grid"><div class="frg-value reveal"><h3>Dependable Performance</h3><p>Ingredients chosen for consistency across the pace of professional service.</p></div><div class="frg-value reveal"><h3>Authentic Character</h3><p>Italian pantry essentials with texture, flavor and a clear culinary purpose.</p></div><div class="frg-value reveal"><h3>Everyday Versatility</h3><p>Solutions for dough, risotto, sides, baking and inspired menu creation.</p></div></div></section>
          <section class="frg-close"><div class="frg-close-media"><img src="images/banners/flour_rice_and_grains.jpeg" alt="Italian pantry ingredients ready for cooking"></div><div class="frg-close-copy reveal"><span class="eyebrow frg-eyebrow--light">The Essential Pantry</span><h2>Give Every Recipe a Stronger Start</h2><p>Prime Line brings chefs the flours, rice and grains that turn foundational ingredients into dishes with real texture, character and purpose.</p><div class="frg-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      fish_and_seafood: () => `
        <div class="fs-page">
          <section class="fs-title reveal"><span class="eyebrow">Fish &amp; Seafood</span><h2>The Flavor of the Sea, Selected with Care</h2><span class="fs-title-sub">Fish, Shellfish &amp; Seafood Specialties for Professional Service</span></section>
          <section class="fs-intro"><div class="fs-intro-photo reveal"><img src="images/categories/fish_and_seafood.jpg" alt="Fish and seafood selected for professional kitchen service"></div><div class="fs-intro-copy reveal"><span class="eyebrow">A Considered Collection</span><h2>From the Water to the Working Kitchen</h2><p>Prime Line brings together fish and seafood selected for their quality, flavor and dependable performance in professional kitchens.</p><p>From elegant starters to generous main courses, our collection helps chefs bring the freshness and character of the sea to every kind of service.</p></div></section>
          <section class="fs-feature fs-feature--selection"><div class="fs-feature-copy reveal"><span class="eyebrow">01 &nbsp; A World of Seafood</span><h2>Versatile Ingredients, Clear Coastal Character</h2><p>From delicate shellfish to robust fish specialties, each selection offers chefs an ingredient with distinct texture, flavor and culinary possibility.</p><p class="fs-detail">Products for antipasti, pasta, risotto, grilling, composed plates and the menus that call for exceptional ingredients.</p></div><div class="fs-feature-media reveal"><img src="images/banners/fish_and_seafood.jpeg" alt="Seafood prepared for hospitality service"></div></section>
          <section class="fs-trio"><article class="fs-card reveal"><div class="fs-card-media fs-card-media--fish"><span>Photography to be placed:<br><strong>images/spots/fresh-fish.jpg</strong></span></div><div class="fs-card-copy"><h3>Fish Specialties</h3><p>Selected fish products for elegant preparation, confident cooking and everyday service.</p></div></article><article class="fs-card reveal"><div class="fs-card-media fs-card-media--shellfish"><span>Photography to be placed:<br><strong>images/spots/shellfish.jpg</strong></span></div><div class="fs-card-copy"><h3>Shellfish</h3><p>Expressive coastal ingredients for pasta, appetizers, risotto and signature dishes.</p></div></article><article class="fs-card reveal"><div class="fs-card-media fs-card-media--specialties"><span>Photography to be placed:<br><strong>images/spots/seafood-specialties.jpg</strong></span></div><div class="fs-card-copy"><h3>Seafood Specialties</h3><p>Distinctive formats and flavors that bring variety and character to the menu.</p></div></article></section>
          <section class="fs-feature fs-feature--service"><div class="fs-feature-media reveal"><img src="images/categories/fish_and_seafood.jpg" alt="Fresh seafood selection for professional kitchens"></div><div class="fs-feature-copy reveal"><span class="eyebrow">02 &nbsp; Ready for Your Menu</span><h2>From Simple Preparation to Signature Dish</h2><p>Our collection supports chefs with seafood that is as adaptable as it is distinctive, making it easier to create dishes with freshness, texture and a lasting sense of place.</p><a href="#">Discover Our Seafood Selection</a></div></section>
          <section class="fs-origins reveal"><span class="eyebrow">A Global Catch</span><h2>Coastal Traditions, Thoughtfully Selected</h2><p>Our seafood assortment brings together trusted specialties from the great coastal regions of the world, selected for their quality and culinary usefulness.</p><div class="fs-origin-list"><span>Mediterranean</span><span>Atlantic</span><span>Pacific</span><span>North Sea</span><span>Global</span></div></section>
          <section class="fs-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="fs-values-grid"><div class="fs-value reveal"><h3>Selected Quality</h3><p>Seafood chosen for flavor, texture and dependable professional performance.</p></div><div class="fs-value reveal"><h3>Kitchen Versatility</h3><p>Formats suited to starters, pasta, mains, catering and creative menu work.</p></div><div class="fs-value reveal"><h3>Coastal Character</h3><p>Ingredients that bring a clear, distinctive sense of the sea to every plate.</p></div></div></section>
          <section class="fs-close"><div class="fs-close-media"><img src="images/banners/fish_and_seafood.jpeg" alt="Seafood presentation for hospitality service"></div><div class="fs-close-copy reveal"><span class="eyebrow fs-eyebrow--light">The Sea at Your Table</span><h2>Give Every Menu a Fresh Point of View</h2><p>Prime Line gives chefs the fish and seafood that make each preparation feel generous, considered and unmistakably memorable.</p><div class="fs-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      gelato: () => `
        <div class="gi-page">
          <section class="gi-title reveal"><span class="eyebrow">Gelati Italiani</span><h2>Italy&apos;s Art of Frozen Pleasure</h2><span class="gi-title-sub">Authentic Gelato for Exceptional Hospitality</span></section>
          <section class="gi-intro"><div class="gi-intro-photo reveal"><img src="images/spots/gelato.jpg" alt="Italian gelato prepared for professional service"></div><div class="gi-intro-copy reveal"><span class="eyebrow">A True Italian Tradition</span><h2>Made to Be Savored, Served to Be Remembered</h2><p>Prime Line selects Italian gelato with the texture, flavor and generosity that make every scoop feel like a small occasion.</p><p>From classic favorites to vibrant contemporary flavors, our collection brings a true gelateria experience to restaurants, hotels, cafes and dessert counters.</p></div></section>
          <section class="gi-feature gi-feature--craft"><div class="gi-feature-copy reveal"><span class="eyebrow">01 &nbsp; The Gelateria Standard</span><h2>Texture, Flavor and a Beautiful Finish</h2><p>Great gelato is defined by balance: dense yet light, creamy yet clean, with each flavor given room to be fully present.</p><p class="gi-detail">Professional formats and a considered assortment for display cases, plated desserts, cups, cones and inspired menu creation.</p></div><div class="gi-feature-media reveal"><img src="images/spots/gelato-service.jpg" alt="Italian gelato served in a professional gelateria"></div></section>
          <section class="gi-trio"><article class="gi-card reveal"><div class="gi-card-media"><img src="images/spots/gelato.jpg" alt="Classic Italian gelato flavors"></div><div class="gi-card-copy"><h3>Classic Flavors</h3><p>Vanilla, chocolate, pistachio and other beloved flavors made with unmistakable Italian character.</p></div></article><article class="gi-card reveal"><div class="gi-card-media gi-card-media--fruit"><img src="images/spots/gelato-service.jpg" alt="Fruit gelato ready for service"></div><div class="gi-card-copy"><h3>Fruit &amp; Sorbet</h3><p>Bright, refreshing selections that bring color and clarity to every display.</p></div></article><article class="gi-card reveal"><div class="gi-card-media gi-card-media--dessert"><img src="images/spots/italian-desserts.jpg" alt="Italian dessert specialty"></div><div class="gi-card-copy"><h3>Gelato Desserts</h3><p>Elegant formats for plated desserts, signature menus and a memorable final course.</p></div></article></section>
          <section class="gi-feature gi-feature--service"><div class="gi-feature-media reveal"><img src="images/banners/desserts_and_gelato.jpeg" alt="Gelato and desserts presented for hospitality service"></div><div class="gi-feature-copy reveal"><span class="eyebrow">02 &nbsp; Ready for Every Service</span><h2>From the Display Case to the Final Course</h2><p>Whether it is the centerpiece of a gelato counter or the last detail of a restaurant menu, Italian gelato gives service an easy sense of pleasure and distinction.</p><a href="#">Discover Our Gelato Selection</a></div></section>
          <section class="gi-origins reveal"><span class="eyebrow">A Culture of Flavor</span><h2>Italian Classics, Made for Today&apos;s Service</h2><p>Our collection honors the flavors that made Italian gelato famous while giving hospitality professionals the quality and flexibility they need every day.</p><div class="gi-origin-list"><span>Pistachio</span><span>Hazelnut</span><span>Chocolate</span><span>Stracciatella</span><span>Fruit</span></div></section>
          <section class="gi-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="gi-values-grid"><div class="gi-value reveal"><h3>Authentic Pleasure</h3><p>Gelato with rich flavor, creamy texture and a genuine Italian point of view.</p></div><div class="gi-value reveal"><h3>Display Ready</h3><p>Selections designed to look as appealing in the case as they taste in the cup.</p></div><div class="gi-value reveal"><h3>Service Versatility</h3><p>Products for counters, restaurants, events and memorable dessert programs.</p></div></div></section>
          <section class="gi-close"><div class="gi-close-media"><img src="images/spots/desserts-gelato-close.jpg" alt="Italian gelato dessert presentation"></div><div class="gi-close-copy reveal"><span class="eyebrow gi-eyebrow--light">The Italian Scoop</span><h2>Make Every Finish a Little More Memorable</h2><p>Prime Line brings hospitality teams the Italian gelato that turns a simple scoop into a lasting impression.</p><div class="gi-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      confections_and_baked_goods: () => `
        <div class="cb-page">
          <section class="cb-title reveal"><span class="eyebrow">Confections &amp; Baked Goods</span><h2>Small Indulgences, Beautifully Made</h2><span class="cb-title-sub">Classic Treats &amp; Bakery Specialties</span></section>
          <section class="cb-intro"><div class="cb-intro-photo reveal"><img src="images/categories/confections_and_baked_goods.jpg" alt="Confections and baked goods for hospitality service"></div><div class="cb-intro-copy reveal"><span class="eyebrow">A Considered Collection</span><h2>Moments of Pleasure, Ready to Serve</h2><p>Prime Line brings together confections and baked goods selected for their craft, character and ability to turn everyday service into a memorable occasion.</p><p>From a refined after-dinner offering to a welcoming display at breakfast, these are the details guests notice and remember.</p></div></section>
          <section class="cb-feature cb-feature--confections"><div class="cb-feature-copy reveal"><span class="eyebrow">01 &nbsp; Fine Confections</span><h2>A Sweet Finish with Real Character</h2><p>Exceptional chocolates, candies and Italian specialties bring texture, flavor and a sense of generosity to every presentation.</p><p class="cb-detail">Selected for restaurants, cafes, hotels, markets and hospitality programs that care about the final detail.</p></div><div class="cb-feature-media cb-media--confections reveal"><span>Photography to be placed:<br><strong>images/spots/fine-confections.jpg</strong></span></div></section>
          <section class="cb-trio"><article class="cb-card reveal"><div class="cb-card-media cb-card-media--chocolate"><span>Photography to be placed:<br><strong>images/spots/chocolates.jpg</strong></span></div><div class="cb-card-copy"><h3>Chocolate</h3><p>Elegant, expressive selections for service, gifting and a memorable finish.</p></div></article><article class="cb-card reveal"><div class="cb-card-media cb-card-media--cookies"><span>Photography to be placed:<br><strong>images/spots/cookies-biscuits.jpg</strong></span></div><div class="cb-card-copy"><h3>Cookies &amp; Biscuits</h3><p>Classic baked favorites with comforting flavor and effortless appeal.</p></div></article><article class="cb-card reveal"><div class="cb-card-media cb-card-media--specialties"><span>Photography to be placed:<br><strong>images/spots/bakery-specialties.jpg</strong></span></div><div class="cb-card-copy"><h3>Bakery Specialties</h3><p>Distinctive treats for displays, pairings and everyday hospitality.</p></div></article></section>
          <section class="cb-feature cb-feature--service"><div class="cb-feature-media cb-media--service reveal"><img src="images/banners/confections_and_baked_goods.jpeg" alt="Confections and baked goods presented for service"></div><div class="cb-feature-copy reveal"><span class="eyebrow">02 &nbsp; Ready for Every Occasion</span><h2>From Counter Display to Final Course</h2><p>Our collection supports every part of hospitality service, whether you are building a pastry counter, creating an amenity or adding a thoughtful final note to the meal.</p><a href="#">Discover Our Confections Selection</a></div></section>
          <section class="cb-origins reveal"><span class="eyebrow">A World of Sweet Traditions</span><h2>Craft and Comfort, Carefully Selected</h2><p>From traditional European specialties to well-loved classics, our assortment brings together products that offer familiar pleasure and distinctive character.</p><div class="cb-origin-list"><span>Italy</span><span>France</span><span>Belgium</span><span>Spain</span><span>United States</span></div></section>
          <section class="cb-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="cb-values-grid"><div class="cb-value reveal"><h3>Beautifully Presented</h3><p>Selections that bring color, texture and appeal to every display.</p></div><div class="cb-value reveal"><h3>Effortlessly Served</h3><p>Thoughtful formats for daily service, events and hospitality programs.</p></div><div class="cb-value reveal"><h3>Distinctive Treats</h3><p>Products chosen for the flavor and charm that guests remember.</p></div></div></section>
          <section class="cb-close"><div class="cb-close-media"><span>Photography to be placed:<br><strong>images/spots/confections-close.jpg</strong></span></div><div class="cb-close-copy reveal"><span class="eyebrow cb-eyebrow--light">Something to Remember</span><h2>End Every Occasion on a Sweet Note</h2><p>Prime Line gives hospitality professionals the confections and baked goods that make a welcome warmer and every goodbye more memorable.</p><div class="cb-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      prosciutto: () => `
        <div class="pp-page">
          <section class="pp-title reveal"><span class="eyebrow">Italian Charcuterie</span><h2>Time, Craft and a Sense of Place</h2><span class="pp-title-sub">Prosciutto &amp; Regional Cured Ham Specialties</span></section>
          <section class="pp-intro"><div class="pp-intro-photo reveal"><img src="images/spots/prosciutto.jpg" alt="Thinly sliced Italian prosciutto ready for service"></div><div class="pp-intro-copy reveal"><span class="eyebrow">Selected for Professional Kitchens</span><h2>Delicate by Nature, Remarkable by Design</h2><p>Prime Line selects Italian prosciutto for its balance of sweetness, savory depth and tender, silky texture.</p><p>Patient aging and regional know-how turn simple ingredients into a charcuterie essential that brings an unmistakable sense of Italy to the table.</p></div></section>
          <section class="pp-feature pp-feature--aging"><div class="pp-feature-copy reveal"><span class="eyebrow">01 &nbsp; The Art of Aging</span><h2>Where Patience Becomes Flavor</h2><p>Great prosciutto develops slowly. Careful salting, open-air aging and a favorable climate create a flavor that is nuanced, fragrant and beautifully balanced.</p><p class="pp-detail">A selection for antipasto, carving, sandwiches, pizzas and the finished dishes where every ingredient has a role to play.</p></div><div class="pp-feature-media reveal"><img src="images/spots/prosciutto-aging.jpg" alt="Prosciutto aging through traditional Italian methods"></div></section>
          <section class="pp-trio"><article class="pp-card reveal"><div class="pp-card-media pp-card-media--parma"><img src="images/spots/prosciutto.jpg" alt="Prosciutto for classic Italian service"></div><div class="pp-card-copy"><h3>Prosciutto di Parma</h3><p>Sweet, fragrant and elegant, with a soft texture that needs little else.</p></div></article><article class="pp-card reveal"><div class="pp-card-media pp-card-media--san-daniele"><span>Photography to be placed:<br><strong>images/spots/san-daniele.jpg</strong></span></div><div class="pp-card-copy"><h3>San Daniele</h3><p>A distinctive expression of gentle curing, mountain air and regional tradition.</p></div></article><article class="pp-card reveal"><div class="pp-card-media pp-card-media--specialties"><span>Photography to be placed:<br><strong>images/spots/prosciutto-specialties.jpg</strong></span></div><div class="pp-card-copy"><h3>Regional Specialties</h3><p>Distinctive cured hams selected for origin, character and professional service.</p></div></article></section>
          <section class="pp-feature pp-feature--service"><div class="pp-feature-media pp-media--service reveal"><img src="images/banners/cured_meats.jpeg" alt="Italian cured meats arranged for service"></div><div class="pp-feature-copy reveal"><span class="eyebrow">02 &nbsp; From Carving Board to Plate</span><h2>Effortless Elegance in Every Slice</h2><p>Prosciutto brings texture, richness and quiet sophistication to a menu, whether served simply or layered into a dish with seasonal ingredients.</p><a href="#">Discover Our Prosciutto Selection</a></div></section>
          <section class="pp-origins reveal"><span class="eyebrow">A Tradition Shaped by Region</span><h2>The Places Behind the Flavor</h2><p>From the hills of Emilia-Romagna to the mountain air of Friuli, each prosciutto tradition reflects the landscape, climate and craft of its origin.</p><div class="pp-origin-list"><span>Parma</span><span>San Daniele</span><span>Emilia-Romagna</span><span>Friuli</span><span>Italy</span></div></section>
          <section class="pp-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="pp-values-grid"><div class="pp-value reveal"><h3>Patiently Aged</h3><p>Selections defined by time, craftsmanship and careful maturation.</p></div><div class="pp-value reveal"><h3>Beautifully Versatile</h3><p>Prosciutto for antipasto, service, cooking and final presentation.</p></div><div class="pp-value reveal"><h3>Authentically Italian</h3><p>Regional expressions with unmistakable origin and character.</p></div></div></section>
          <section class="pp-close"><div class="pp-close-media"><img src="images/spots/prosciutto-aging.jpg" alt="Italian prosciutto tradition"></div><div class="pp-close-copy reveal"><span class="eyebrow pp-eyebrow--light">A Tradition Worth Savoring</span><h2>Bring the Character of Italy to Every Plate</h2><p>Prime Line gives chefs the prosciutto that turns simple hospitality into an experience with depth, warmth and a true sense of place.</p><div class="pp-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      pasta: () => `
        <div class="pa-page">
          <section class="pa-title reveal"><span class="eyebrow">Italian Pasta</span><h2>The Shape of Italian Tradition</h2><span class="pa-title-sub">Classic Cuts, Regional Shapes &amp; Professional Performance</span></section>
          <section class="pa-intro"><div class="pa-intro-photo reveal"><img src="images/categories/pasta.jpg" alt="Italian pasta prepared for professional kitchen service"></div><div class="pa-intro-copy reveal"><span class="eyebrow">A Considered Collection</span><h2>Every Shape Tells a Story</h2><p>Prime Line brings together exceptional Italian pasta selected for texture, performance and the unmistakable character of regional tradition.</p><p>From everyday staples to distinctive shapes, our collection gives chefs a foundation for dishes that feel both generous and precise.</p></div></section>
          <section class="pa-feature pa-feature--bronze"><div class="pa-feature-copy reveal"><span class="eyebrow">01 &nbsp; Bronze-Cut Pasta</span><h2>Texture That Holds the Sauce</h2><p>Bronze-cut pasta offers a beautifully textured surface that captures sauces and gives every bite a more expressive, satisfying finish.</p><p class="pa-detail">Selected for restaurants, hotels and foodservice professionals who value consistent cooking performance and authentic Italian character.</p></div><div class="pa-feature-media pa-media--bronze reveal"><img src="images/banners/opciones/mejores/pasta.jpg" alt="Bronze-cut pasta ready for cooking"></div></section>
          <section class="pa-trio"><article class="pa-card reveal"><div class="pa-card-media pa-card-media--long"><img src="images/banners/opciones/mejores/pasta1.jpg" alt="Long Italian pasta"></div><div class="pa-card-copy"><h3>Long Pasta</h3><p>Classic cuts for sauces that call for elegance, movement and texture.</p></div></article><article class="pa-card reveal"><div class="pa-card-media pa-card-media--short"><span>Photography to be placed:<br><strong>images/spots/short-pasta.jpg</strong></span></div><div class="pa-card-copy"><h3>Short Pasta</h3><p>Versatile shapes made for robust sauces, bakes and everyday service.</p></div></article><article class="pa-card reveal"><div class="pa-card-media pa-card-media--specialties"><span>Photography to be placed:<br><strong>images/spots/pasta-specialties.jpg</strong></span></div><div class="pa-card-copy"><h3>Regional Specialties</h3><p>Distinctive forms that bring a more personal Italian story to the menu.</p></div></article></section>
          <section class="pa-feature pa-feature--service"><div class="pa-feature-media pa-media--service reveal"><img src="images/banners/pasta.jpeg" alt="Italian pasta dish ready for service"></div><div class="pa-feature-copy reveal"><span class="eyebrow">02 &nbsp; Made for the Working Kitchen</span><h2>From First Boil to Final Plate</h2><p>Great pasta is simple, but never accidental. Our collection supports chefs with shapes and formats that cook with consistency and serve with confidence.</p><a href="#">Discover Our Pasta Selection</a></div></section>
          <section class="pa-origins reveal"><span class="eyebrow">Italy, Region by Region</span><h2>Shapes Born from Place and Tradition</h2><p>From the north to the south, each pasta tradition has its own purpose. Our selection celebrates that variety while meeting the needs of modern professional service.</p><div class="pa-origin-list"><span>Emilia-Romagna</span><span>Campania</span><span>Puglia</span><span>Sicily</span><span>Liguria</span></div></section>
          <section class="pa-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="pa-values-grid"><div class="pa-value reveal"><h3>Authentic Texture</h3><p>Selections chosen for the bite, body and character chefs expect.</p></div><div class="pa-value reveal"><h3>Consistent Performance</h3><p>Reliable formats for the pace and precision of professional kitchens.</p></div><div class="pa-value reveal"><h3>Regional Variety</h3><p>Classic shapes and distinctive specialties from across Italy.</p></div></div></section>
          <section class="pa-close"><div class="pa-close-media"><img src="images/banners/opciones/mejores/pasta1.jpg" alt="Italian pasta served with seasonal ingredients"></div><div class="pa-close-copy reveal"><span class="eyebrow pa-eyebrow--light">A Taste of Italy</span><h2>Make Every Plate Worth Gathering Around</h2><p>Prime Line brings chefs the Italian pasta that turns simple ingredients into dishes with warmth, texture and lasting character.</p><div class="pa-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      'olivesand oil': () => `
        <div class="oo-page">
          <section class="oo-title reveal"><span class="eyebrow">Olives &amp; Olive Oil</span><h2>The Character of the Mediterranean</h2><span class="oo-title-sub">Extra Virgin Olive Oil, Olives &amp; Table Specialties</span></section>
          <section class="oo-intro"><div class="oo-intro-photo reveal"><img src="images/categories/oils.jpg" alt="Extra virgin olive oil selected for professional kitchens"></div><div class="oo-intro-copy reveal"><span class="eyebrow">Selected at the Source</span><h2>From Grove to Table, with Nothing Lost</h2><p>Prime Line brings together oils and olives selected for their expression of origin, balance and unmistakable Mediterranean character.</p><p>From a bright finishing oil to olives served simply at the table, every selection gives chefs a direct connection to the ingredients behind the flavor.</p></div></section>
          <section class="oo-feature oo-feature--oil"><div class="oo-feature-copy reveal"><span class="eyebrow">01 &nbsp; Extra Virgin Olive Oil</span><h2>Harvested for Flavor, Chosen for the Kitchen</h2><p>Great olive oil captures freshness, fruit and a distinct sense of place. Our collection offers profiles for every preparation, from cooking to the final pour.</p><p class="oo-detail">Selected for dressings, finishing, dipping, grilling, roasting and the dishes where exceptional ingredients need to remain clearly present.</p></div><div class="oo-feature-media oo-media--oil reveal"><span>Photography to be placed:<br><strong>images/spots/olive-oil-harvest.jpg</strong></span></div></section>
          <section class="oo-trio"><article class="oo-card reveal"><div class="oo-card-media oo-card-media--evoo"><span>Photography to be placed:<br><strong>images/spots/extra-virgin-olive-oil.jpg</strong></span></div><div class="oo-card-copy"><h3>Extra Virgin Olive Oil</h3><p>Expressive oils selected for freshness, balance and a beautiful finish.</p></div></article><article class="oo-card reveal"><div class="oo-card-media oo-card-media--olives"><img src="images/categories/olives.jpg" alt="Mediterranean olives for professional service"></div><div class="oo-card-copy"><h3>Table Olives</h3><p>Distinctive varieties for antipasto, cocktails, salads and service.</p></div></article><article class="oo-card reveal"><div class="oo-card-media oo-card-media--specialties"><span>Photography to be placed:<br><strong>images/spots/olive-specialties.jpg</strong></span></div><div class="oo-card-copy"><h3>Olive Specialties</h3><p>Mediterranean essentials that bring depth, richness and character.</p></div></article></section>
          <section class="oo-feature oo-feature--service"><div class="oo-feature-media oo-media--service reveal"><img src="images/banners/olivesand%20oil.jpeg" alt="Olives and olive oil prepared for professional service"></div><div class="oo-feature-copy reveal"><span class="eyebrow">02 &nbsp; A Foundation of Flavor</span><h2>Essential to the Way You Cook</h2><p>Used at the beginning, throughout the preparation or as the final touch, olive oil and olives give kitchens an ingredient that works with quiet confidence across the menu.</p><a href="#">Discover Our Olive Oil Selection</a></div></section>
          <section class="oo-origins reveal"><span class="eyebrow">Many Groves, Distinctive Expressions</span><h2>Olive Traditions with a Sense of Place</h2><p>Our collection celebrates the variety of Mediterranean olive-growing regions, each with its own climate, cultivars and culinary point of view.</p><div class="oo-origin-list"><span>Italy</span><span>Spain</span><span>Greece</span><span>Portugal</span><span>California</span></div></section>
          <section class="oo-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="oo-values-grid"><div class="oo-value reveal"><h3>Carefully Selected</h3><p>Oils and olives chosen for origin, freshness and authentic flavor.</p></div><div class="oo-value reveal"><h3>Kitchen Versatility</h3><p>Profiles suited to preparation, finishing and confident daily service.</p></div><div class="oo-value reveal"><h3>Mediterranean Character</h3><p>Ingredients that bring a direct sense of place to every plate.</p></div></div></section>
          <section class="oo-close"><div class="oo-close-media"><span>Photography to be placed:<br><strong>images/spots/olive-oil-close.jpg</strong></span></div><div class="oo-close-copy reveal"><span class="eyebrow oo-eyebrow--light">The Essential Pour</span><h2>Bring Every Ingredient into Focus</h2><p>Prime Line gives chefs the oils and olives that let simple preparations speak clearly, with freshness, balance and unmistakable Mediterranean warmth.</p><div class="oo-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      condiments_sauces_and_stocks: () => `
        <div class="cs-page">
          <section class="cs-title reveal"><span class="eyebrow">Condiments, Sauces &amp; Stocks</span><h2>The Ingredients That Bring a Dish Together</h2><span class="cs-title-sub">Depth, Brightness and Everyday Versatility</span></section>
          <section class="cs-intro"><div class="cs-intro-photo reveal"><img src="images/categories/condiments_sauces_and_stocks.jpg" alt="Condiments, sauces and pantry ingredients for professional kitchens"></div><div class="cs-intro-copy reveal"><span class="eyebrow">A Considered Pantry</span><h2>Build Flavor from the First Step</h2><p>Prime Line selects the sauces, condiments and stocks that give chefs a dependable foundation for dishes with depth and personality.</p><p>From a simple finishing touch to the base of a signature sauce, these are the ingredients that make every decision in the kitchen work harder.</p></div></section>
          <section class="cs-feature cs-feature--sauces"><div class="cs-feature-copy reveal"><span class="eyebrow">01 &nbsp; Sauces &amp; Tomatoes</span><h2>Flavor with a Clear Point of View</h2><p>Thoughtfully prepared sauces and exceptional tomato products bring consistency, brightness and character to every service.</p><p class="cs-detail">Selected for pasta, pizza, braises, seafood, vegetables and the many dishes that begin with a beautiful sauce.</p></div><div class="cs-feature-media cs-media--sauces reveal"><span>Photography to be placed:<br><strong>images/spots/sauces-and-tomatoes.jpg</strong></span></div></section>
          <section class="cs-trio"><article class="cs-card reveal"><div class="cs-card-media cs-card-media--sauces"><span>Photography to be placed:<br><strong>images/spots/italian-sauces.jpg</strong></span></div><div class="cs-card-copy"><h3>Sauces</h3><p>Reliable flavor and authentic character for every kind of service.</p></div></article><article class="cs-card reveal"><div class="cs-card-media cs-card-media--condiments"><span>Photography to be placed:<br><strong>images/spots/condiments.jpg</strong></span></div><div class="cs-card-copy"><h3>Condiments</h3><p>Small details with the power to sharpen, brighten and balance.</p></div></article><article class="cs-card reveal"><div class="cs-card-media cs-card-media--stocks"><span>Photography to be placed:<br><strong>images/spots/stocks.jpg</strong></span></div><div class="cs-card-copy"><h3>Stocks &amp; Bases</h3><p>A dependable foundation for sauces, soups, braises and more.</p></div></article></section>
          <section class="cs-feature cs-feature--service"><div class="cs-feature-media cs-media--service reveal"><img src="images/banners/condiments_sauces_and_stocks.jpeg" alt="Condiments and sauces prepared for professional kitchen service"></div><div class="cs-feature-copy reveal"><span class="eyebrow">02 &nbsp; Built for the Working Kitchen</span><h2>Versatile Ingredients, Confident Cooking</h2><p>From speed and consistency during prep to the final balance of a plate, our collection supports chefs with ingredients that are ready to become part of their own point of view.</p><a href="#">Discover Our Condiment Selection</a></div></section>
          <section class="cs-origins reveal"><span class="eyebrow">A Global Pantry</span><h2>Essential Ingredients, Thoughtfully Sourced</h2><p>Our assortment brings together Mediterranean traditions and dependable professional staples, selected for authentic flavor and everyday usefulness.</p><div class="cs-origin-list"><span>Italy</span><span>Spain</span><span>France</span><span>United States</span><span>Global</span></div></section>
          <section class="cs-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="cs-values-grid"><div class="cs-value reveal"><h3>Kitchen Essential</h3><p>Ingredients chosen for the daily demands of professional service.</p></div><div class="cs-value reveal"><h3>Consistent Flavor</h3><p>Reliable profiles that give every preparation a confident start.</p></div><div class="cs-value reveal"><h3>Endless Versatility</h3><p>Solutions for prep, cooking, finishing and inspired menu creation.</p></div></div></section>
          <section class="cs-close"><div class="cs-close-media"><span>Photography to be placed:<br><strong>images/spots/condiments-close.jpg</strong></span></div><div class="cs-close-copy reveal"><span class="eyebrow cs-eyebrow--light">The Finishing Touch</span><h2>Give Every Dish Its Full Expression</h2><p>Prime Line brings the foundational ingredients and finishing details that let chefs build flavor with purpose, precision and imagination.</p><div class="cs-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      mozzarellaburrata: () => `
        <div class="mb-page">
          <section class="mb-title reveal"><span class="eyebrow">Fresh Italian Cheese</span><h2>Freshness, Texture and Italian Tradition</h2><span class="mb-title-sub">Mozzarella, Burrata &amp; Fresh Cheese Specialties</span></section>
          <section class="mb-intro">
            <div class="mb-intro-photo reveal"><img src="images/banners/mozzarellaburrata.jpg" alt="Fresh mozzarella and burrata prepared for service"></div>
            <div class="mb-intro-copy reveal"><span class="eyebrow">Selected for Professional Kitchens</span><h2>Made to Be Enjoyed at Its Freshest</h2><p>Prime Line brings together fresh Italian cheeses selected for their delicate texture, clean flavor and reliable performance in professional kitchens.</p><p>From creamy burrata to classic mozzarella, each selection adds a sense of generosity and authentic Italian character to the plate.</p></div>
          </section>
          <section class="mb-feature mb-feature--burrata">
            <div class="mb-feature-copy reveal"><span class="eyebrow">01 &nbsp; Burrata</span><h2>Delicate Outside, Remarkable Within</h2><p>With its tender mozzarella shell and rich, creamy center, burrata delivers a luxurious texture that makes even the simplest dish feel considered.</p><p class="mb-detail">Ideal for antipasti, seasonal vegetables, salads, pizzas and composed plates where freshness takes the lead.</p></div>
            <div class="mb-feature-media mb-media--burrata reveal"><span>Photography to be placed:<br><strong>images/spots/burrata-service.jpg</strong></span></div>
          </section>
          <section class="mb-trio">
            <article class="mb-card reveal"><div class="mb-card-media mb-card-media--mozzarella"><span>Photography to be placed:<br><strong>images/spots/fresh-mozzarella.jpg</strong></span></div><div class="mb-card-copy"><h3>Mozzarella</h3><p>Clean, milky flavor and supple texture for classic Italian preparations.</p></div></article>
            <article class="mb-card reveal"><div class="mb-card-media mb-card-media--burrata"><span>Photography to be placed:<br><strong>images/spots/burrata.jpg</strong></span></div><div class="mb-card-copy"><h3>Burrata</h3><p>A creamy centerpiece for dishes that call for freshness and distinction.</p></div></article>
            <article class="mb-card reveal"><div class="mb-card-media mb-card-media--specialties"><span>Photography to be placed:<br><strong>images/spots/fresh-cheese-specialties.jpg</strong></span></div><div class="mb-card-copy"><h3>Fresh Specialties</h3><p>Italian classics selected for versatile, expressive service.</p></div></article>
          </section>
          <section class="mb-feature mb-feature--service">
            <div class="mb-feature-media mb-media--service reveal"><img src="images/banners/mozzarellaburrata.jpg" alt="Mozzarella and burrata for professional kitchen service"></div>
            <div class="mb-feature-copy reveal"><span class="eyebrow">02 &nbsp; From Kitchen to Table</span><h2>Fresh Cheese for Every Expression</h2><p>Whether served simply with olive oil and tomatoes or used as the finishing touch on a signature dish, fresh cheese gives chefs a versatile ingredient with immediate appeal.</p><a href="#">Discover Our Fresh Cheese Selection</a></div>
          </section>
          <section class="mb-origins reveal"><span class="eyebrow">A Tradition of Freshness</span><h2>Italian Craft, Made for Today&rsquo;s Service</h2><p>Our fresh cheese collection reflects the techniques, ingredients and care behind some of Italy&rsquo;s most beloved table traditions.</p><div class="mb-origin-list"><span>Puglia</span><span>Campania</span><span>Lazio</span><span>Apulia</span><span>Italy</span></div></section>
          <section class="mb-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="mb-values-grid"><div class="mb-value reveal"><h3>Fresh by Nature</h3><p>Selections chosen for delicate texture and clean, expressive flavor.</p></div><div class="mb-value reveal"><h3>Made for Service</h3><p>Versatile fresh cheeses for prep, presentation and daily kitchen use.</p></div><div class="mb-value reveal"><h3>Authentically Italian</h3><p>Products shaped by the traditions and character of their origins.</p></div></div></section>
          <section class="mb-close"><div class="mb-close-media"><span>Photography to be placed:<br><strong>images/spots/mozzarella-burrata-close.jpg</strong></span></div><div class="mb-close-copy reveal"><span class="eyebrow mb-eyebrow--light">A Fresh Perspective</span><h2>Bring Italian Freshness to Every Plate</h2><p>From everyday classics to memorable centerpieces, Prime Line gives chefs the fresh Italian cheeses that make simple ingredients shine.</p><div class="mb-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      coffee_and_tea: () => `
        <div class="coffee-page">
          <section class="coffee-title reveal"><span class="eyebrow">Coffee &amp; Tea</span><h2>Ritual, Roast and Remarkable Flavor</h2><span class="coffee-title-sub">Selected for Cafes, Restaurants and Hospitality</span></section>
          <section class="coffee-intro">
            <div class="coffee-intro-photo reveal"><img src="images/banners/coffee_and_tea.jpeg" alt="Coffee and tea prepared for professional service"><span class="coffee-placeholder">Hero photography to be placed:<br><strong>images/spots/coffee-intro.jpg</strong></span></div>
            <div class="coffee-intro-copy reveal"><span class="eyebrow">A Considered Collection</span><h2>Good Service Begins with What Is in the Cup</h2><p>Prime Line sources coffees and teas selected for aroma, balance and consistency across every service.</p><p>From the first morning espresso to the final tea after dinner, our collection helps hospitality professionals create memorable daily rituals.</p></div>
          </section>
          <section class="coffee-feature coffee-feature--roast">
            <div class="coffee-feature-copy reveal"><span class="eyebrow">01 &nbsp; Espresso &amp; Coffee</span><h2>Depth, Balance and a Beautiful Finish</h2><p>Thoughtfully selected coffees bring clarity to espresso service and character to every preparation.</p><p class="coffee-detail">Whole bean and ground formats for cafes, restaurants, hotels and hospitality teams that value dependable performance.</p></div>
            <div class="coffee-feature-media coffee-media--roast reveal"><span>Photography to be placed:<br><strong>images/spots/coffee-roasting.jpg</strong></span></div>
          </section>
          <section class="coffee-trio">
            <article class="coffee-card reveal"><div class="coffee-card-media coffee-card-media--espresso"><span>Photography to be placed:<br><strong>images/spots/coffee-espresso.jpg</strong></span></div><div class="coffee-card-copy"><h3>Espresso</h3><p>Rich, balanced profiles created for the pace and precision of professional service.</p></div></article>
            <article class="coffee-card reveal"><div class="coffee-card-media coffee-card-media--beans"><span>Photography to be placed:<br><strong>images/spots/coffee-beans.jpg</strong></span></div><div class="coffee-card-copy"><h3>Coffee Beans</h3><p>Distinctive origins and roast profiles for espresso, batch brew and specialty preparation.</p></div></article>
            <article class="coffee-card reveal"><div class="coffee-card-media coffee-card-media--tea"><span>Photography to be placed:<br><strong>images/spots/tea-service.jpg</strong></span></div><div class="coffee-card-copy"><h3>Tea</h3><p>Classic and expressive selections that bring warmth, balance and ritual to the table.</p></div></article>
          </section>
          <section class="coffee-feature coffee-feature--service">
            <div class="coffee-feature-media coffee-media--service reveal"><span>Photography to be placed:<br><strong>images/spots/coffee-service.jpg</strong></span></div>
            <div class="coffee-feature-copy reveal"><span class="eyebrow">02 &nbsp; Built for Service</span><h2>Consistency Behind Every Pour</h2><p>The best coffee program is one that works beautifully from the first cup to the last. Our assortment supports dependable preparation, thoughtful presentation and an experience guests remember.</p><a href="#">Discover Our Coffee Selection</a></div>
          </section>
          <section class="coffee-origins reveal"><span class="eyebrow">From Origin to Service</span><h2>A World of Coffee, Thoughtfully Curated</h2><p>We look for coffees with a clear sense of place, then select formats that make their character practical for professional kitchens and hospitality teams.</p><div class="coffee-origin-list"><span>Italy</span><span>Central America</span><span>South America</span><span>Africa</span><span>Asia</span></div></section>
          <section class="coffee-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="coffee-values-grid"><div class="coffee-value reveal"><h3>Reliable Performance</h3><p>Selections chosen for consistency, balance and daily service.</p></div><div class="coffee-value reveal"><h3>Distinctive Flavor</h3><p>Roasts and origins with character that guests can recognize.</p></div><div class="coffee-value reveal"><h3>Complete Ritual</h3><p>Coffee and tea for every moment of the hospitality experience.</p></div></div></section>
          <section class="coffee-close"><div class="coffee-close-media"><span>Photography to be placed:<br><strong>images/spots/coffee-close.jpg</strong></span></div><div class="coffee-close-copy reveal"><span class="eyebrow coffee-eyebrow--light">The Daily Ritual</span><h2>Make Every Cup Part of the Experience</h2><p>From a perfectly pulled espresso to a quiet cup of tea, Prime Line helps hospitality teams serve with warmth, consistency and intention.</p><div class="coffee-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      cured_meats: () => `
        <div class="cm-page">
          <section class="cm-title reveal"><span class="eyebrow">Charcuterie</span><h2>A Complete Italian Cured Meats Collection</h2><span class="cm-title-sub">Pancetta, Salami, Sopressata, Mortadella &amp; More</span></section>
          <section class="cm-intro">
            <div class="cm-intro-photo reveal"><img src="images/categories/cured_meats.jpg" alt="A curated selection of cured meats for a charcuterie board"></div>
            <div class="cm-intro-copy reveal"><span class="eyebrow">Selected for Professional Kitchens</span><h2>Crafted with Patience, Served with Purpose</h2><p>Prime Line brings together a complete selection of Italian cured meats shaped by regional tradition, patient aging and exceptional ingredients.</p><p>From pancetta and salami to sopressata, mortadella and distinctive specialties, the collection brings depth, texture and a true sense of origin to the table.</p></div>
          </section>
          <section class="cm-feature cm-feature--prosciutto">
            <div class="cm-feature-copy reveal"><span class="eyebrow">01 &nbsp; The Charcuterie Board</span><h2>A World of Flavor, Ready to Compose</h2><p>Classic Italian cured meats offer a spectrum of textures and flavors, from the gentle sweetness of mortadella to the bold spice of sopressata and the savory depth of pancetta.</p><p class="cm-detail">Selected for antipasto, sandwiches, pizzas, pasta dishes, grazing boards and signature preparations.</p></div>
            <div class="cm-feature-media cm-media--prosciutto reveal"><span>Photography to be placed:<br><strong>images/spots/prosciutto-aging.jpg</strong></span></div>
          </section>
          <section class="cm-trio">
            <article class="cm-card reveal"><div class="cm-card-media cm-card-media--prosciutto"><span>Photography to be placed:<br><strong>images/spots/pancetta.jpg</strong></span></div><div class="cm-card-copy"><h3>Pancetta &amp; Specialty Cuts</h3><p>Rich, savory selections for cooking, finishing and expressive Italian dishes.</p></div></article>
            <article class="cm-card reveal"><div class="cm-card-media cm-card-media--salami"><span>Photography to be placed:<br><strong>images/spots/salami-sopressata.jpg</strong></span></div><div class="cm-card-copy"><h3>Salami &amp; Sopressata</h3><p>Regional recipes and varied textures for boards, sandwiches and cooking.</p></div></article>
            <article class="cm-card reveal"><div class="cm-card-media cm-card-media--specialties"><span>Photography to be placed:<br><strong>images/spots/mortadella-cooked-meats.jpg</strong></span></div><div class="cm-card-copy"><h3>Mortadella &amp; Cooked Meats</h3><p>Classic specialties with delicate texture, rich flavor and broad appeal.</p></div></article>
          </section>
          <section class="cm-feature cm-feature--service">
            <div class="cm-feature-media cm-media--service reveal"><img src="images/banners/cured_meats.jpeg" alt="Cured meats prepared for professional service"></div>
            <div class="cm-feature-copy reveal"><span class="eyebrow">02 &nbsp; From Counter to Table</span><h2>Built for the Way You Serve</h2><p>Our collection gives chefs and foodservice professionals the versatility to create memorable boards, sandwiches, pasta dishes and elegant finishing touches.</p><a href="#">Discover Our Charcuterie Selection</a></div>
          </section>
          <section class="cm-origins reveal"><span class="eyebrow">A Sense of Place</span><h2>Regional Traditions, Carefully Chosen</h2><p>Each region brings its own technique, climate and culinary point of view. Our assortment celebrates those distinctions while serving the needs of modern hospitality.</p><div class="cm-origin-list"><span>Parma</span><span>San Daniele</span><span>Tuscany</span><span>Emilia-Romagna</span><span>Spain</span></div></section>
          <section class="cm-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="cm-values-grid"><div class="cm-value reveal"><h3>True Craftsmanship</h3><p>Selections shaped by proven regional methods and patient aging.</p></div><div class="cm-value reveal"><h3>Service Ready</h3><p>Versatile formats for professional prep, presentation and service.</p></div><div class="cm-value reveal"><h3>Distinctive Origins</h3><p>Charcuterie with the depth and character of its place of origin.</p></div></div></section>
          <section class="cm-close"><div class="cm-close-media"><span>Photography to be placed:<br><strong>images/spots/cured-meats-close.jpg</strong></span></div><div class="cm-close-copy reveal"><span class="eyebrow cm-eyebrow--light">A Tradition of Taste</span><h2>Give Every Plate a Sense of Place</h2><p>From celebrated classics to regional discoveries, Prime Line brings authentic charcuterie to the chefs and hospitality professionals who value true flavor.</p><div class="cm-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      balsamic1: () => `
        <div class="vc-page">
          <section class="vc-title reveal"><span class="eyebrow">Vinegars</span><h2>The Depth of True Balsamic</h2><span class="vc-title-sub">Balsamic &amp; Specialty Vinegars</span></section>
          <section class="vc-intro">
            <div class="vc-intro-photo reveal"><img src="images/spots/vinegars-intro.jpg" alt="Balsamic vinegar being poured over a prepared dish"><span class="vc-placeholder">Photography to be placed:<br><strong>images/spots/vinegars-intro.jpg</strong></span></div>
            <div class="vc-intro-copy reveal"><span class="eyebrow">Selected for Professional Kitchens</span><h2>Acidity, Balance and Character</h2><p>Prime Line brings together a considered selection of balsamic and specialty vinegars chosen for depth, balance and culinary versatility.</p><p>From everyday finishing to refined gastronomy, each vinegar helps chefs add brightness, complexity and a distinctive sense of place.</p></div>
          </section>
          <section class="vc-feature vc-feature--origin">
            <div class="vc-feature-copy reveal"><span class="eyebrow">01 &nbsp; Balsamic from Modena</span><h2>Where Time Becomes Flavor</h2><p>Traditional balsamic vinegar develops its character through patience, careful reduction and thoughtful aging.</p><p class="vc-detail">Selected profiles for dressings, marinades, sauces, cheese service, vegetables, desserts and finishing.</p></div>
            <div class="vc-feature-photo reveal"><img src="images/spots/vinegars-modena.jpg" alt="Balsamic vinegar and wooden aging barrels in Modena"><span class="vc-placeholder">Photography to be placed:<br><strong>images/spots/vinegars-modena.jpg</strong></span></div>
          </section>
          <section class="vc-trio">
            <article class="vc-card reveal"><div class="vc-card-media"><span>Photography to be placed:<br><strong>images/spots/vinegars-balsamic.jpg</strong></span></div><div class="vc-card-copy"><h3>Balsamic</h3><p>Rich, balanced and versatile for finishing, sauces and composed dishes.</p></div></article>
            <article class="vc-card reveal"><div class="vc-card-media"><span>Photography to be placed:<br><strong>images/spots/vinegars-wine.jpg</strong></span></div><div class="vc-card-copy"><h3>Wine Vinegars</h3><p>Bright acidity and clean character for vinaigrettes, marinades and cooking.</p></div></article>
            <article class="vc-card reveal"><div class="vc-card-media"><span>Photography to be placed:<br><strong>images/spots/vinegars-specialty.jpg</strong></span></div><div class="vc-card-copy"><h3>Specialty Vinegars</h3><p>Distinctive fruit and regional profiles for creative culinary applications.</p></div></article>
          </section>
          <section class="vc-feature vc-feature--culinary">
            <div class="vc-feature-photo reveal"><img src="images/spots/vinegars-dish.jpg" alt="Vinegar being used to finish a composed dish"><span class="vc-placeholder">Photography to be placed:<br><strong>images/spots/vinegars-dish.jpg</strong></span></div>
            <div class="vc-feature-copy reveal"><span class="eyebrow">02 &nbsp; Culinary Versatility</span><h2>The Final Note That Brings a Dish Together</h2><p>A thoughtful vinegar can sharpen a sauce, balance richness, lift vegetables and give a finished dish a longer, more expressive finish.</p><a href="#">Discover Our Vinegar Selection</a></div>
          </section>
          <section class="vc-origins reveal"><span class="eyebrow">Selected Across Regions</span><h2>Distinct Origins, Considered Profiles</h2><p>From Modena and Reggio Emilia to celebrated wine-producing regions, our collection reflects the traditions and ingredients behind every vinegar.</p><div class="vc-origin-list"><span>Modena</span><span>Reggio Emilia</span><span>Italy</span><span>France</span><span>Spain</span></div></section>
          <section class="vc-values"><span class="eyebrow">A Collection Built for Food Professionals</span><div class="vc-values-grid"><div class="vc-value reveal"><h3>Carefully Selected</h3><p>Profiles chosen for balance, origin and culinary performance.</p></div><div class="vc-value reveal"><h3>Professional Versatility</h3><p>Flavors suited to preparation, finishing and service.</p></div><div class="vc-value reveal"><h3>Authentic Character</h3><p>Vinegars selected to bring depth and distinction.</p></div></div></section>
          <section class="vc-close"><div class="vc-close-media"><span>Photography to be placed:<br><strong>images/spots/vinegars-close.jpg</strong></span></div><div class="vc-close-copy reveal"><span class="eyebrow cv-eyebrow--light">A Taste of Time</span><h2>Balance Every Plate with Intention</h2><p>From classic balsamic to distinctive specialty vinegars, Prime Line helps chefs finish every dish with clarity, depth and character.</p><div class="vc-close-actions"><a href="#" class="btn btn--light">View Products</a><a href="#contact" class="btn btn--light">Request Information</a></div></div></section>
        </div>`,
      antipasto_and_vegetables: () => `
        <section class="cv-title reveal">
          <h2>Preserved Vegetables</h2>
          <span class="cv-title-sub">Antipastos &amp; Vegetables</span>
        </section>
        <section class="cv-intro">
          <div class="cv-intro-photo reveal"><img src="images/spots/agnoni1.png" alt="Balsamic-glazed onions and grilled mushrooms, rustic Italian kitchen"></div>
          <div class="cv-intro-copy reveal">
            <span class="eyebrow">Curated for Professional Kitchens</span>
            <h2>Exceptional Ingredients. Endless Possibilities.</h2>
            <p>Prime Line Distributors sources a distinctive selection of preserved vegetables and Mediterranean specialties chosen for their flavor, consistency, and presentation.</p>
            <p>From everyday essentials to harder-to-find delicacies, our portfolio helps chefs create memorable dishes without compromising quality.</p>
          </div>
        </section>
        <section class="cv-trio">
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/Primizia Artichokes VE59.png" alt="Artichoke hearts, whole and halved" style="object-position: left center;">
            <div class="cv-trio-label"><h3>Artichokes</h3><p>Tender, flavorful and remarkably versatile, from antipasti and salads to pizzas, pastas and signature entrées.</p></div>
          </a>
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/deliziedicalabria02.jpg" alt="Hand-harvesting fresh Calabrian chili peppers into a crate">
            <div class="cv-trio-label"><h3>Peppers</h3><p>Fiery Calabrian chilies, sun-ripened and hand-harvested for bold, authentic heat.</p></div>
          </a>
          <a class="cv-trio-card reveal" href="#">
            <img src="images/spots/cappers.jpg" alt="Capers in a rustic wooden bowl">
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
          <div class="cv-spot-photo reveal"><img src="images/spots/buscema1.png" alt="Assorted grilled and roasted vegetable antipasti in oil"></div>
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
          <img src="images/spots/deliziedicalabria01.jpg" alt="Calabrian chili peppers, freshly harvested on a hillside overlooking the coast">
          <div class="cv-close-content reveal">
            <span class="eyebrow cv-eyebrow--light">Grown in Calabria, Italy</span>
            <h1>Sun-Ripened, Hand-Harvested, Truly Authentic</h1>
            <p>From sun-drenched hillsides overlooking the Ionian coast, our Calabrian chili peppers are hand-harvested at their peak and prepared using time-honored methods, bringing fiery, authentic flavor to every dish.</p>
          </div>
        </section>`,
    };

    function defaultDetailTemplate(data) {
      const action = data.title === 'Crafted for the Art of Pastry'
        ? '<a class="btn btn--dark banner-caption-action" href="baking-and-pastry.html">Explore the Full Collection</a>'
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

    function updateCategoryDetail(slideEl) {
      if (!categoryDetail) return;
      const img = slideEl.querySelector('img');
      const key = decodeURIComponent((img?.getAttribute('src') || '').split('/').pop() || '').replace(/\.[^.]+$/, '');
      const data = bannerCopy[key] || { eyebrow: 'Prime Line', title: img?.alt || 'Category', text: 'Reference text coming soon.' };
      const render = categoryDetailTemplates[key] || (() => defaultDetailTemplate(data));
      categoryDetail.classList.add('is-fading');
      setTimeout(() => {
        categoryDetail.innerHTML = `
          <div class="category-detail-nav" aria-label="Slide navigation">
            <button type="button" class="detail-slider-arrow detail-slider-arrow--prev" aria-label="Previous slide"></button>
            <button type="button" class="detail-slider-arrow detail-slider-arrow--next" aria-label="Next slide"></button>
          </div>
          ${render()}`;
        categoryDetail.classList.remove('is-fading');
        categoryDetail.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      }, 300);
    }

    const initSlider = () => {
      const slides = Array.from(track.querySelectorAll('.slide'));
      if (!slides.length) return;
      let current = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
      let timer;
      let autoplayAllowed = true;

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
      updateCategoryDetail(slides[current]);

      function goTo(index) {
        slides[current].classList.remove('is-active');
        dots[current].classList.remove('is-active');
        current = (index + slides.length) % slides.length;
        slides[current].classList.add('is-active');
        dots[current].classList.add('is-active');
        updateCategoryDetail(slides[current]);
        resetTimer();
      }
      categoryDetail?.addEventListener('click', (e) => {
        const button = e.target.closest('.detail-slider-arrow');
        if (!button) return;
        goTo(button.classList.contains('detail-slider-arrow--prev') ? current - 1 : current + 1);
      });
      function resetTimer() {
        clearInterval(timer);
        if (!autoplayAllowed) return;
        timer = setInterval(() => goTo(current + 1), 5000);
      }

      slider.setAttribute('tabindex', '0');
      slider.setAttribute('aria-label', 'Featured categories slider');
      slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goTo(current - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goTo(current + 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          goTo(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          goTo(slides.length - 1);
        }
      });
      slider.addEventListener('mouseenter', () => clearInterval(timer));
      slider.addEventListener('mouseleave', resetTimer);
      slider.addEventListener('focusin', () => clearInterval(timer));
      slider.addEventListener('focusout', (e) => {
        if (!slider.contains(e.relatedTarget)) resetTimer();
      });

      // Pause autoplay as soon as the banner starts leaving the viewport (user reading the category detail below); resume only once it's fully back on screen.
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        autoplayAllowed = entry.intersectionRatio >= 0.99;
        if (autoplayAllowed) resetTimer();
        else clearInterval(timer);
      }, { threshold: [0, 0.99, 1] });
      visibilityObserver.observe(slider);

      prevBtn.addEventListener('click', () => goTo(current - 1));
      nextBtn.addEventListener('click', () => goTo(current + 1));
      resetTimer();
    };

    autoLoadSlides().finally(initSlider);
  }
});
